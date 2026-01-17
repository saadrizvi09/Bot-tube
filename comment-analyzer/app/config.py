"""
Configuration settings for the Comment Analyzer API.
Optimized for Hugging Face free tier deployment.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings."""
    
    # API Settings
    APP_NAME: str = "YouTube Comment Analyzer"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    PORT: int = 8000
    
    # YouTube Data API v3
    YOUTUBE_API_KEY: str = ""  # Set via environment variable
    
    # Comment Scraping Settings
    MAX_COMMENTS: int = 100  # Max comments to fetch
    DEFAULT_COMMENTS: int = 50  # Default if not specified
    
    # VADER Settings (Instant Analysis)
    VADER_COMPOUND_THRESHOLD_POSITIVE: float = 0.05
    VADER_COMPOUND_THRESHOLD_NEGATIVE: float = -0.3
    
    # BART Settings (Deep Analysis)
    BART_MODEL: str = "valhalla/distilbart-mnli-12-6"
    TOP_COMMENTS_FOR_DEEP_ANALYSIS: int = 10  # Only analyze top N comments
    
    # Aspect Categories for Zero-Shot Classification
    ASPECT_CATEGORIES: list = [
        "video quality",
        "audio quality", 
        "content value",
        "entertainment",
        "educational value",
        "host/presenter",
        "editing",
        "length/pacing",
        "recommendation",
        "criticism"
    ]
    
    # Spam/Troll Detection Thresholds
    SPAM_KEYWORDS: list = [
        "subscribe to my channel",
        "check out my",
        "visit my profile",
        "free v-bucks",
        "free robux",
        "click here",
        "link in bio",
        "giveaway",
        "dm me",
        "follow me"
    ]
    
    TROLL_INDICATORS: list = [
        "first",
        "ratio",
        "nobody:",
        "no one:",
        "L + ratio"
    ]
    
    # Text Processing
    MIN_COMMENT_LENGTH: int = 3
    MAX_COMMENT_LENGTH: int = 500
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
