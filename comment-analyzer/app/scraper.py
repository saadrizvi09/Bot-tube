"""
YouTube Comment Scraper using youtube-comment-downloader.
Fetches comments efficiently with sorting options.
"""

import re
import logging
from typing import List, Dict, Any, Optional, Generator
from youtube_comment_downloader import YoutubeCommentDownloader, SORT_BY_POPULAR, SORT_BY_RECENT
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
    Fetch comments from a YouTube video.
    """
    video_id = extract_video_id(video_url)
    logger.info(f"Fetching comments for video: {video_id} using youtube-comment-downloader")
    
    downloader = YoutubeCommentDownloader()
    
    # Set user agent to avoid bot detection
    downloader.session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    })

    # Set sort order (0 = popular, 1 = recent)
    sort_mode = SORT_BY_POPULAR if sort_by == "popular" else SORT_BY_RECENT
    
    comments = []
    reply_count_total = 0
    
    try:
        logger.info(f"Attempting to fetch up to {max_comments} comments with sort_mode={sort_mode}...")
        
        # Fetch comments using the generator
        comment_generator = downloader.get_comments_from_url(
            f"https://www.youtube.com/watch?v={video_id}",
            sort_by=sort_mode
        )
        
        comment_count = 0
        for comment in comment_generator:
            comment_count += 1
            
            # Stop if we have enough comments
            if len(comments) >= max_comments:
                break
            
            # Skip empty or invalid comments
            if not comment or not isinstance(comment, dict):
                continue
            
            # Use 'cid' as the primary ID, fallback to 'id'
            comment_id = comment.get('cid') or comment.get('id')
            if not comment_id:
                continue

            # Check for reply status
            is_reply = comment.get('reply', False) or comment.get('parent') is not None
            
            if is_reply and not include_replies:
                continue

            # Extract fields with safe defaults
            comment_data = {
                'id': comment_id,
                'text': comment.get('text', ''),
                'author': comment.get('author', 'Unknown'),
                'likes': comment.get('votes', 0) or comment.get('like_count', 0),
                'reply_count': comment.get('replies', 0) or comment.get('reply_count', 0),
                'timestamp': comment.get('time') or comment.get('published_time', ''),
                'is_reply': is_reply,
                'heart': comment.get('heart', False),
                'photo': comment.get('photo', '')
            }
            
            # Parse likes (might be string like "1.2K")
            if isinstance(comment_data['likes'], str):
                comment_data['likes'] = _parse_count(comment_data['likes'])
            
            if isinstance(comment_data['reply_count'], str):
                comment_data['reply_count'] = _parse_count(comment_data['reply_count'])
            
            reply_count_total += comment_data['reply_count']
            comments.append(comment_data)

    except Exception as e:
        logger.error(f"Error fetching comments: {str(e)}")
        raise RuntimeError(f"Failed to fetch comments. Error: {str(e)}")
    
    logger.info(f"Fetched {len(comments)} valid comments out of {comment_count} total")
    
    if len(comments) == 0:
        logger.warning(f"No comments found for video {video_id}")
    
    return {
        'video_id': video_id,
        'total_fetched': len(comments),
        'total_replies': reply_count_total,
        'comments': comments
    }


def _parse_count(count_str: str) -> int:
    """Parse count strings like '1.2K', '3.5M' to integers."""
    if not count_str:
        return 0
    
    count_str = str(count_str).strip().upper()
    
    try:
        if 'K' in count_str:
            return int(float(count_str.replace('K', '')) * 1000)
        elif 'M' in count_str:
            return int(float(count_str.replace('M', '')) * 1000000)
        else:
            return int(count_str)
    except (ValueError, TypeError):
        return 0


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
