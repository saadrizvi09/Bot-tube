"""
YouTube Comment Scraper using youtube-comment-downloader.
Fetches comments efficiently with sorting options.
"""

import re
import logging
from typing import List, Dict, Any, Optional
import yt_dlp
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def extract_video_id(url_or_id: str) -> str:
    """
    Extract video ID from various YouTube URL formats.
    """
    # Common YouTube URL patterns
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$'  # Plain video ID
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    
    raise ValueError(f"Could not extract video ID from: {url_or_id}")


def fetch_comments(
    video_url: str,
    max_comments: int = 50,
    sort_by: str = "popular",
    include_replies: bool = False
) -> Dict[str, Any]:
    """
    Fetch comments from a YouTube video using yt-dlp.
    """
    video_id = extract_video_id(video_url)
    logger.info(f"Fetching comments for video: {video_id} using yt-dlp")
    
    # Configure yt-dlp
    ydl_opts = {
        'skip_download': True,
        'getcomments': True,
        'writeinfojson': False,
        'quiet': True,
        'no_warnings': True,
        'force_ipv4': True,  # Fix for HF Spaces DNS/Network issues
        'extract_flat': True, # Don't download video
        'extractor_args': {
            'youtube': {
                'skip': ['dash', 'hls'], # Skip video manifest processing
                # yt-dlp doesn't strictly limit comment count in headers, 
                # but we process what we get. 
                # For heavily commented videos, this might be slow, 
                # but it's reliable.
            }
        }
    }

    # If max_comments is small, we ideally want to tell yt-dlp to stop early,
    # but yt-dlp fetches all metadata first. 
    # For a free HF Space, this is a trade-off for reliability over speed.
    
    comments = []
    reply_count_total = 0
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # We use extract_info. 
            # Note: For very large videos, fetching ALL comments is slow.
            # But yt-dlp is the only robust way correctly handling IPv4/DNS errors.
            try:
                info = ydl.extract_info(video_id, download=False)
            except yt_dlp.utils.DownloadError as e:
                # Handle specific yt-dlp errors
                if "Sign in" in str(e):
                    raise RuntimeError("Video requires sign-in (age-restricted or private).")
                raise e

            raw_comments = info.get('comments', [])
            
            # If no comments found in 'comments' key, try checking if it's disabled
            if raw_comments is None:
                 raw_comments = []

            # Sort manually if needed (yt-dlp usually returns sorted by top)
            # sort_by param in function is mostly ignored as yt-dlp defaults to "best"
            
            for comment in raw_comments:
                if len(comments) >= max_comments:
                    break
                
                # Check reply status (yt-dlp structure)
                parent_id = comment.get('parent')
                is_reply = parent_id is not None and parent_id != 'root'
                
                if is_reply and not include_replies:
                    continue

                comment_data = {
                    'id': comment.get('id'),
                    'text': comment.get('text', ''),
                    'author': comment.get('author', 'Unknown'),
                    'likes': comment.get('like_count', 0),
                    'reply_count': 0, # yt-dlp flattens comments, so getting precise reply count per thread is hard
                    'timestamp': comment.get('timestamp', 0),
                    'is_reply': is_reply,
                    'heart': False, # Not always available
                    'photo': '' # Not always available
                }
                
                comments.append(comment_data)

    except Exception as e:
        logger.error(f"Error fetching comments with yt-dlp: {str(e)}")
        raise RuntimeError(f"Failed to fetch comments: {str(e)}")
    
    logger.info(f"Fetched {len(comments)} valid comments")
    
    return {
        'video_id': video_id,
        'total_fetched': len(comments),
        'total_replies': reply_count_total, # approximate or 0
        'comments': comments
    }

def get_top_comments(
    comments: List[Dict[str, Any]], 
    n: int = 10, 
    sort_by: str = "likes"
) -> List[Dict[str, Any]]:
    """
    Get top N comments sorted by specified criteria.
    
    Args:
        comments: List of comment dictionaries
        n: Number of top comments to return
        sort_by: Sort criteria - "likes" or "replies"
        
    Returns:
        List of top N comments
    """
    if sort_by == "replies":
        sorted_comments = sorted(comments, key=lambda x: x.get('reply_count', 0), reverse=True)
    else:  # default to likes
        sorted_comments = sorted(comments, key=lambda x: x.get('likes', 0), reverse=True)
    
    return sorted_comments[:n]
