"""
YouTube Comment Fetcher using YouTube Data API v3.
Fetches comments via the official API with sorting options.
"""

import re
import logging
from typing import List, Dict, Any, Optional
from app.config import get_settings

logger = logging.getLogger(__name__)

# Lazy-loaded API client
_youtube_client = None


def _get_youtube_client():
    """Get or create the YouTube Data API client (lazy loading)."""
    global _youtube_client
    if _youtube_client is None:
        import os
        from googleapiclient.discovery import build

        settings = get_settings()
        # Try settings first, then fall back to os.environ directly
        api_key = settings.YOUTUBE_API_KEY or os.environ.get("YOUTUBE_API_KEY", "")
        # Strip any surrounding quotes just in case
        api_key = api_key.strip('"').strip("'")
        if not api_key:
            raise RuntimeError(
                "YOUTUBE_API_KEY is not set. "
                "Please set it as an environment variable or in your .env file."
            )
        _youtube_client = build("youtube", "v3", developerKey=api_key)
    return _youtube_client


def extract_video_id(url_or_id: str) -> str:
    """
    Extract video ID from various YouTube URL formats.
    """
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
    include_replies: bool = False,
) -> Dict[str, Any]:
    """
    Fetch comments from a YouTube video using the YouTube Data API v3.

    Args:
        video_url: YouTube video URL or ID.
        max_comments: Maximum number of top-level comments to return.
        sort_by: "popular" (relevance) or "newest" (time).
        include_replies: Whether to include reply comments.

    Returns:
        Dict with video_id, total_fetched, total_replies, and comments list.
    """
    video_id = extract_video_id(video_url)
    logger.info(f"Fetching comments for video: {video_id} using YouTube Data API v3")

    youtube = _get_youtube_client()

    # Map sort_by to API order parameter
    # API accepts "relevance" (popular) or "time" (newest)
    order = "relevance" if sort_by == "popular" else "time"

    comments: List[Dict[str, Any]] = []
    reply_count_total = 0
    next_page_token: Optional[str] = None

    try:
        while len(comments) < max_comments:
            # How many to request this page (API max is 100)
            page_size = min(100, max_comments - len(comments))

            request_params: Dict[str, Any] = {
                "part": "snippet",
                "videoId": video_id,
                "maxResults": page_size,
                "order": order,
                "textFormat": "plainText",
            }
            if next_page_token:
                request_params["pageToken"] = next_page_token

            response = youtube.commentThreads().list(**request_params).execute()

            items = response.get("items", [])
            if not items:
                break

            for item in items:
                if len(comments) >= max_comments:
                    break

                snippet = item["snippet"]["topLevelComment"]["snippet"]
                thread_reply_count = item["snippet"].get("totalReplyCount", 0)
                reply_count_total += thread_reply_count

                comment_data = {
                    "id": item["snippet"]["topLevelComment"]["id"],
                    "text": snippet.get("textDisplay", ""),
                    "author": snippet.get("authorDisplayName", "Unknown"),
                    "likes": snippet.get("likeCount", 0),
                    "reply_count": thread_reply_count,
                    "timestamp": snippet.get("publishedAt", ""),
                    "is_reply": False,
                    "heart": False,
                    "photo": snippet.get("authorProfileImageUrl", ""),
                }
                comments.append(comment_data)

                # Fetch replies if requested
                if include_replies and thread_reply_count > 0:
                    replies = _fetch_replies(
                        youtube,
                        item["id"],
                        max_replies=min(thread_reply_count, 5),
                    )
                    comments.extend(replies)

            next_page_token = response.get("nextPageToken")
            if not next_page_token:
                break

    except Exception as e:
        error_msg = str(e)
        if "commentsDisabled" in error_msg:
            raise RuntimeError("Comments are disabled for this video.")
        if "videoNotFound" in error_msg:
            raise RuntimeError(f"Video not found: {video_id}")
        logger.error(f"Error fetching comments: {error_msg}")
        raise RuntimeError(f"Failed to fetch comments: {error_msg}")

    logger.info(f"Fetched {len(comments)} comments for video {video_id}")

    if len(comments) == 0:
        logger.warning(f"No comments found for video {video_id}")

    return {
        "video_id": video_id,
        "total_fetched": len(comments),
        "total_replies": reply_count_total,
        "comments": comments,
    }


def _fetch_replies(
    youtube, parent_id: str, max_replies: int = 5
) -> List[Dict[str, Any]]:
    """Fetch replies for a given comment thread."""
    replies: List[Dict[str, Any]] = []
    try:
        response = (
            youtube.comments()
            .list(
                part="snippet",
                parentId=parent_id,
                maxResults=min(max_replies, 100),
                textFormat="plainText",
            )
            .execute()
        )

        for item in response.get("items", []):
            snippet = item["snippet"]
            replies.append(
                {
                    "id": item["id"],
                    "text": snippet.get("textDisplay", ""),
                    "author": snippet.get("authorDisplayName", "Unknown"),
                    "likes": snippet.get("likeCount", 0),
                    "reply_count": 0,
                    "timestamp": snippet.get("publishedAt", ""),
                    "is_reply": True,
                    "heart": False,
                    "photo": snippet.get("authorProfileImageUrl", ""),
                }
            )
    except Exception as e:
        logger.warning(f"Failed to fetch replies for {parent_id}: {e}")

    return replies


def get_top_comments(
    comments: List[Dict[str, Any]],
    n: int = 10,
    sort_by: str = "likes",
) -> List[Dict[str, Any]]:
    """
    Get top N comments sorted by specified criteria.

    Args:
        comments: List of comment dictionaries.
        n: Number of top comments to return.
        sort_by: Sort criteria – "likes" or "replies".

    Returns:
        List of top N comments.
    """
    key = "reply_count" if sort_by == "replies" else "likes"
    sorted_comments = sorted(
        comments, key=lambda x: x.get(key, 0), reverse=True
    )
    return sorted_comments[:n]
