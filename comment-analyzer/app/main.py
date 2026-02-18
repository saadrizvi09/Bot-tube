"""
YouTube Comment Analyzer API
FastAPI application for analyzing YouTube video comments.

Features:
- Instant sentiment analysis using VADER (< 1 second)
- Spam and troll detection
- Comment preprocessing with autocorrect

Deployment: Hugging Face Spaces
"""

import logging
import time
import asyncio
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.models import (
    AnalyzeRequest,
    InstantAnalysisResponse,
    HealthResponse,
    ErrorResponse,
    CommentData,
    SentimentType,
    CommentType,
    FilteredStats,
)
from app.scraper import fetch_comments, extract_video_id, get_top_comments
from app.preprocessing import preprocess_comments
from app.vader_analyzer import analyze_comments_vader, calculate_sentiment_distribution, get_extreme_comments

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup
    logger.info("Starting Comment Analyzer API...")
    logger.info(f"App: {settings.APP_NAME} v{settings.APP_VERSION}")
    
    # Optionally preload BART model (comment out for faster cold starts)
    # asyncio.create_task(asyncio.to_thread(preload_model))
    
    yield
    
    # Shutdown
    logger.info("Shutting down Comment Analyzer API...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Analyze YouTube video comments for sentiment, aspects, and spam detection.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Helper Functions ==============

def create_comment_data(comment: dict) -> CommentData:
    """Convert internal comment dict to CommentData model."""
    return CommentData(
        id=comment.get('id', ''),
        text=comment.get('text', ''),
        text_clean=comment.get('text_clean', comment.get('text', '')),
        author=comment.get('author', 'Unknown'),
        likes=comment.get('likes', 0),
        reply_count=comment.get('reply_count', 0),
        timestamp=comment.get('timestamp'),
        sentiment=comment.get('sentiment', SentimentType.NEUTRAL),
        sentiment_score=comment.get('sentiment_score', 0.0),
        comment_type=comment.get('comment_type', CommentType.NORMAL),
        is_filtered=comment.get('is_filtered', False)
    )


def calculate_filtered_stats(comments: list) -> FilteredStats:
    """Calculate spam/troll filter statistics."""
    total = len(comments)
    spam_count = sum(1 for c in comments if c.get('comment_type') == CommentType.SPAM)
    troll_count = sum(1 for c in comments if c.get('comment_type') == CommentType.TROLL)
    filtered = spam_count + troll_count
    
    return FilteredStats(
        total_filtered=filtered,
        spam_count=spam_count,
        troll_count=troll_count,
        spam_percentage=round((spam_count / total) * 100, 1) if total > 0 else 0,
        troll_percentage=round((troll_count / total) * 100, 1) if total > 0 else 0
    )





# ============== API Endpoints ==============

@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint with health information."""
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        timestamp=datetime.utcnow(),
        models_loaded={
            "vader": True,  # VADER is always available (lightweight)
        }
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return await root()


@app.post("/analyze", response_model=InstantAnalysisResponse)
async def analyze_comments(
    request: AnalyzeRequest
):
    """
    Analyze YouTube video comments.
    
    This endpoint returns instant VADER analysis results.
    """
    start_time = time.time()
    
    try:
        # Extract video ID
        video_id = extract_video_id(request.video_url)
        logger.info(f"Analyzing comments for video: {video_id}")
        
        # Fetch comments
        try:
            result = fetch_comments(
                video_url=request.video_url,
                max_comments=request.max_comments or settings.DEFAULT_COMMENTS,
                sort_by="newest",
                include_replies=request.include_replies or False
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch comments: {str(e)}")
        
        raw_comments = result['comments']
        
        if not raw_comments:
            raise HTTPException(
                status_code=404, 
                detail="No comments found. This video may have comments disabled, be private, or have no comments yet. Try another video."
            )
        
        # Preprocess comments
        processed_comments = preprocess_comments(raw_comments)
        
        # Run VADER analysis (instant)
        analyzed_comments = analyze_comments_vader(processed_comments)
        
        # Calculate statistics
        sentiment_dist = calculate_sentiment_distribution(analyzed_comments)
        filtered_stats = calculate_filtered_stats(analyzed_comments)
        
        # Get extreme comments
        top_positive = get_extreme_comments(analyzed_comments, SentimentType.POSITIVE, 5)
        top_negative = get_extreme_comments(analyzed_comments, SentimentType.NEGATIVE, 5)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Analysis completed in {processing_time:.0f}ms")
        
        return InstantAnalysisResponse(
            video_id=video_id,
            video_title=None,
            total_comments=len(raw_comments),
            analyzed_comments=len(analyzed_comments),
            sentiment_distribution=sentiment_dist,
            filtered_stats=filtered_stats,
            top_positive_comments=[create_comment_data(c) for c in top_positive],
            top_negative_comments=[create_comment_data(c) for c in top_negative],
            processing_time_ms=round(processing_time, 2)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Quick Analysis Endpoint (No Deep Analysis) ==============

@app.get("/test-video")
async def test_video(video_url: str = Query(..., description="YouTube video URL")):
    """
    Test if a video has accessible comments without full analysis.
    Returns video info and comment availability status.
    """
    try:
        video_id = extract_video_id(video_url)
        
        # Try to fetch just 1 comment to test
        result = fetch_comments(
            video_url=video_url,
            max_comments=1,
            sort_by="popular"
        )
        
        return {
            "video_id": video_id,
            "accessible": True,
            "has_comments": len(result['comments']) > 0,
            "message": "Video is accessible and has comments" if result['comments'] else "Video accessible but has no comments"
        }
        
    except Exception as e:
        return {
            "video_id": video_id if 'video_id' in locals() else None,
            "accessible": False,
            "has_comments": False,
            "error": str(e),
            "message": "Cannot access comments for this video"
        }


@app.get("/quick-analyze")
async def quick_analyze(
    video_url: str = Query(..., description="YouTube video URL"),
    max_comments: int = Query(30, ge=10, le=50, description="Max comments")
):
    """
    Quick sentiment analysis without deep processing.
    Faster response but no aspect-based insights.
    """
    start_time = time.time()
    
    try:
        video_id = extract_video_id(video_url)
        
        result = fetch_comments(
            video_url=video_url,
            max_comments=max_comments,
            sort_by="newest"
        )
        
        if not result['comments']:
            raise HTTPException(
                status_code=404,
                detail="No comments found. This video may have comments disabled or no comments yet."
            )
        
        processed = preprocess_comments(result['comments'])
        analyzed = analyze_comments_vader(processed)
        sentiment_dist = calculate_sentiment_distribution(analyzed)
        filtered_stats = calculate_filtered_stats(analyzed)
        
        processing_time = (time.time() - start_time) * 1000
        
        return {
            "video_id": video_id,
            "total_comments": len(result['comments']),
            "analyzed_comments": len(analyzed),
            "sentiment_distribution": sentiment_dist.model_dump(),
            "filtered_stats": filtered_stats.model_dump(),
            "processing_time_ms": round(processing_time, 2)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Error Handlers ==============

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            status_code=exc.status_code
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc),
            status_code=500
        ).model_dump()
    )


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
