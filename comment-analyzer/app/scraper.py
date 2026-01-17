"""
YouTube Comment Scraper using YouTube Data API v3.
Official, reliable method for fetching comments.
"""

import re
import logging
from typing import List, Dict, Any, Optional
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
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
    Fetch comments from a YouTube video using YouTube Data API v3.
    """
    video_id = extract_video_id(video_url)
    logger.info(f"Fetching comments for video: {video_id} using YouTube Data API v3")
    
    if not settings.YOUTUBE_API_KEY:
        raise RuntimeError("YouTube API Key not configured. Please set YOUTUBE_API_KEY environment variable.")
    
    try:
        # Build YouTube API client
        youtube = build('youtube', 'v3', developerKey=settings.YOUTUBE_API_KEY)
        
        comments = []
        reply_count_total = 0
        
        # Determine sort order
        order = 'relevance' if sort_by == 'popular' else 'time'
        
        # Fetch comment threads
        request = youtube.commentThreads().list(
            part='snippet,replies',
            videoId=video_id,
            maxResults=min(max_comments, 100),  # API limit is 100 per request
            order=order,
            textFormat='plainText'
        )
        
        logger.info(f"Fetching up to {max_comments} comments with order={order}...")
        
        while request and len(comments) < max_comments:
            response = request.execute()
            
            for item in response.get('items', []):
                if len(comments) >= max_comments:
                    break
                
                # Get top-level comment
                top_comment = item['snippet']['topLevelComment']['snippet']
                
                comment_data = {
                    'id': item['id'],
                    'text': top_comment['textDisplay'],
                    'author': top_comment['authorDisplayName'],
                    'likes': top_comment.get('likeCount', 0),
                    'reply_count': item['snippet'].get('totalReplyCount', 0),
                    'timestamp': top_comment['publishedAt'],
                    'is_reply': False,
                    'heart': False,
                    'photo': top_comment.get('authorProfileImageUrl', '')
                }
                
                reply_count_total += comment_data['reply_count']
                comments.append(comment_data)
                
                # Add replies if requested
                if include_replies and 'replies' in item:
                    for reply_item in item['replies']['comments']:
                        if len(comments) >= max_comments:
                            break
                        
                        reply = reply_item['snippet']
                        reply_data = {
                            'id': reply_item['id'],
                            'text': reply['textDisplay'],
                            'author': reply['authorDisplayName'],
                            'likes': reply.get('likeCount', 0),
                            'reply_count': 0,
                            'timestamp': reply['publishedAt'],
                            'is_reply': True,
                            'heart': False,
                            'photo': reply.get('authorProfileImageUrl', '')
                        }
                        comments.append(reply_data)
            
            # Get next page
            if 'nextPageToken' in response and len(comments) < max_comments:
                request = youtube.commentThreads().list(
                    part='snippet,replies',
                    videoId=video_id,
                    maxResults=min(max_comments - len(comments), 100),
                    order=order,
                    textFormat='plainText',
                    pageToken=response['nextPageToken']
                )
            else:
                request = None
        
        logger.info(f"Fetched {len(comments)} comments successfully")
        
        return {
            'video_id': video_id,
            'total_fetched': len(comments),
            'total_replies': reply_count_total,
            'comments': comments
        }
        
    except HttpError as e:
        error_content = e.content.decode('utf-8') if e.content else str(e)
        logger.error(f"YouTube API HttpError: {error_content}")
        
        if e.resp.status == 403:
            if 'commentsDisabled' in error_content:
                raise RuntimeError("Comments are disabled on this video")
            elif 'quotaExceeded' in error_content:
                raise RuntimeError("YouTube API quota exceeded. Please try again later.")
            else:
                raise RuntimeError(f"Access forbidden: {error_content}")
        elif e.resp.status == 404:
            raise RuntimeError("Video not found. Please check the URL.")
        else:
            raise RuntimeError(f"YouTube API error: {error_content}")
            
    except Exception as e:
        logger.error(f"Error fetching comments: {str(e)}")
        raise RuntimeError(f"Failed to fetch comments: {str(e)}")


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
