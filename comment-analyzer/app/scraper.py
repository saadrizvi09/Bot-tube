"""
YouTube Comment Scraper using yt-dlp.
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
    
    # Configure yt-dlp options
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True,
        'getcomments': True,
        'format': 'worst',  # Don't fetch video, just metadata
        'youtube_include_dash_manifest': False,
        'extractor_args': {
            'youtube': {
                'comment_sort': ['top'] if sort_by == 'popular' else ['new'],
                'max_comments': [max_comments * 3],  # Fetch more
            }
        },
    }
    
    comments = []
    reply_count_total = 0
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Attempting to fetch up to {max_comments} comments...")
            
            # Extract info and comments
            try:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            except yt_dlp.utils.ExtractorError as e:
                error_msg = str(e).lower()
                logger.error(f"ExtractorError: {error_msg}")
                if 'sign in' in error_msg or 'age' in error_msg or 'members' in error_msg:
                    raise RuntimeError("This video is restricted (age-restricted, members-only, or requires sign-in). Try a public video.")
                elif 'private' in error_msg:
                    raise RuntimeError("Video is private")
                elif 'unavailable' in error_msg:
                    raise RuntimeError("Video is unavailable")
                else:
                    raise RuntimeError(f"Cannot access video: {str(e)}")
            
            if not info:
                raise RuntimeError("Failed to extract video information")
            
            raw_comments = info.get('comments', [])
            
            if not raw_comments:
                logger.warning(f"No comments found for video {video_id}")
                return {
                    'video_id': video_id,
                    'total_fetched': 0,
                    'total_replies': 0,
                    'comments': []
                }
            
            logger.info(f"Extracted {len(raw_comments)} raw comments from yt-dlp")
            
            # Process comments
            for comment in raw_comments:
                if not comment or not isinstance(comment, dict):
                    continue
                
                # Stop if we have enough comments
                if len(comments) >= max_comments:
                    break
                
                comment_id = comment.get('id')
                if not comment_id:
                    continue
                
                # Check if it's a reply
                is_reply = comment.get('parent', 'root') != 'root'
                
                if is_reply and not include_replies:
                    continue
                
                # Extract fields
                comment_data = {
                    'id': comment_id,
                    'text': comment.get('text', ''),
                    'author': comment.get('author', 'Unknown'),
                    'likes': comment.get('like_count', 0) or 0,
                    'reply_count': comment.get('reply_count', 0) or 0,
                    'timestamp': comment.get('timestamp', 0),
                    'is_reply': is_reply,
                    'heart': comment.get('is_favorited', False),
                    'photo': comment.get('author_thumbnail', '')
                }
                
                reply_count_total += comment_data['reply_count']
                comments.append(comment_data)
            
            logger.info(f"Processed {len(comments)} valid comments")
            
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e).lower()
        logger.error(f"yt-dlp DownloadError: {error_msg}")
        
        if 'sign in' in error_msg or 'age' in error_msg:
            raise RuntimeError("This video requires sign-in or is age-restricted. Please try a different video without restrictions.")
        elif 'private' in error_msg or 'unavailable' in error_msg:
            raise RuntimeError("Video is private or unavailable. Please check the URL.")
        elif 'copyright' in error_msg:
            raise RuntimeError("Video has copyright restrictions")
        elif 'members-only' in error_msg:
            raise RuntimeError("Video is members-only and requires a membership")
        else:
            raise RuntimeError(f"Cannot access video: {str(e)}")
            
    except Exception as e:
        logger.error(f"Error fetching comments: {str(e)}")
        error_msg = str(e).lower()
        
        if "consent" in error_msg:
            raise RuntimeError("YouTube consent required. This video may require accepting cookies/terms.")
        elif "forbidden" in error_msg or "403" in error_msg:
            raise RuntimeError("Access forbidden - Video may be restricted in this region")
        elif "comments" in error_msg and "disabled" in error_msg:
            raise RuntimeError("Comments are disabled on this video")
        else:
            raise RuntimeError(f"Failed to fetch comments: {str(e)}")
    
    return {
        'video_id': video_id,
        'total_fetched': len(comments),
        'total_replies': reply_count_total,
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
