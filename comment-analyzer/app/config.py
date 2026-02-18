"""
Configuration settings for the Comment Analyzer API.
Deployed on Hugging Face Spaces (Docker).
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path


def _find_env_files():
    """Find all .env files to load, returns list of paths."""
    env_files = []
    # 1) Local .env in comment-analyzer/ (CWD when started by dev.bat)
    local_env = Path(".env")
    if local_env.exists():
        env_files.append(str(local_env.resolve()))
    # 2) Parent .env in project root (ytbot/.env)
    parent_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if parent_env.exists():
        env_files.append(str(parent_env))
    # 3) Also check relative ../.env from CWD
    parent_cwd_env = Path("../.env")
    if parent_cwd_env.exists():
        resolved = str(parent_cwd_env.resolve())
        if resolved not in env_files:
            env_files.append(resolved)
    return tuple(env_files) if env_files else None


class Settings(BaseSettings):
    """Application settings."""
    model_config = SettingsConfigDict(
        env_file=_find_env_files(),
        extra="ignore",
    )
    
    # API Settings
    APP_NAME: str = "YouTube Comment Analyzer"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    PORT: int = 8000
    
    # YouTube Data API v3
    YOUTUBE_API_KEY: str = ""  # Set via env var YOUTUBE_API_KEY
    
    # Comment Fetching Settings
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


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
