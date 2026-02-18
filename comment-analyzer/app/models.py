"""
Pydantic models for API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class SentimentType(str, Enum):
    """Sentiment classification types."""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


class CommentType(str, Enum):
    """Comment classification types."""
    NORMAL = "normal"
    SPAM = "spam"
    TROLL = "troll"


# ============== Request Models ==============

class AnalyzeRequest(BaseModel):
    """Request model for comment analysis."""
    video_url: str = Field(..., description="YouTube video URL or ID")
    max_comments: Optional[int] = Field(50, ge=10, le=100, description="Max comments to fetch")
    include_replies: Optional[bool] = Field(False, description="Include reply comments")
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "max_comments": 50,
                "include_replies": False
            }
        }


# ============== Response Models ==============

class CommentData(BaseModel):
    """Individual comment data."""
    id: str
    text: str
    text_clean: str
    author: str
    likes: int
    reply_count: int
    timestamp: Optional[str] = None
    sentiment: SentimentType
    sentiment_score: float
    comment_type: CommentType
    is_filtered: bool = False


class SentimentDistribution(BaseModel):
    """Sentiment distribution statistics."""
    positive: int
    negative: int
    neutral: int
    positive_percentage: float
    negative_percentage: float
    neutral_percentage: float
    average_sentiment: float


class FilteredStats(BaseModel):
    """Spam and troll filter statistics."""
    total_filtered: int
    spam_count: int
    troll_count: int
    spam_percentage: float
    troll_percentage: float


class InstantAnalysisResponse(BaseModel):
    """Response for instant VADER analysis."""
    video_id: str
    video_title: Optional[str] = None
    total_comments: int
    analyzed_comments: int
    sentiment_distribution: SentimentDistribution
    filtered_stats: FilteredStats
    top_positive_comments: List[CommentData]
    top_negative_comments: List[CommentData]
    processing_time_ms: float


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    timestamp: datetime
    models_loaded: Dict[str, bool]


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    detail: Optional[str] = None
    status_code: int
