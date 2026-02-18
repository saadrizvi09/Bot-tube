---
title: YouTube Comment Analyzer
emoji: 📊
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# YouTube Comment Analyzer API 📊

A fast, free-tier friendly API for analyzing YouTube video comments using sentiment analysis and aspect-based classification.

## Features

- **⚡ Instant Sentiment Analysis** - VADER-based analysis returns results in < 1 second
- **🔍 Deep Aspect Analysis** - BART-based zero-shot classification for detailed insights
- **🛡️ Spam & Troll Detection** - Automatic filtering of low-quality comments
- **📝 Text Preprocessing** - Autocorrect, cleaning, and normalization

## Quick Start

### Analyze Comments

```bash
curl -X POST "https://your-space.hf.space/analyze" \
  -H "Content-Type: application/json" \
  -d '{"video_url": "https://www.youtube.com/watch?v=VIDEO_ID", "max_comments": 50}'
```

### Quick Analysis (No Deep Processing)

```bash
curl "https://your-space.hf.space/quick-analyze?video_url=https://www.youtube.com/watch?v=VIDEO_ID"
```

### Check Deep Analysis Status

```bash
curl "https://your-space.hf.space/analyze/deep/{job_id}"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/analyze` | POST | Full analysis with background deep processing |
| `/analyze/deep/{job_id}` | GET | Get deep analysis results |
| `/analyze/full/{job_id}` | GET | Get complete analysis results |
| `/quick-analyze` | GET | Quick sentiment-only analysis |
| `/model/preload` | POST | Warm up BART model |

## Response Structure

### Instant Analysis Response

```json
{
  "job_id": "abc12345",
  "video_id": "dQw4w9WgXcQ",
  "total_comments": 50,
  "analyzed_comments": 47,
  "sentiment_distribution": {
    "positive": 25,
    "negative": 10,
    "neutral": 12,
    "positive_percentage": 53.2,
    "negative_percentage": 21.3,
    "neutral_percentage": 25.5,
    "average_sentiment": 0.234
  },
  "filtered_stats": {
    "total_filtered": 3,
    "spam_count": 2,
    "troll_count": 1
  },
  "top_positive_comments": [...],
  "top_negative_comments": [...],
  "deep_analysis_status": "processing",
  "processing_time_ms": 847
}
```

### Deep Analysis Response

```json
{
  "job_id": "abc12345",
  "status": "complete",
  "progress": 100,
  "insights": {
    "aspects": [
      {
        "aspect": "content value",
        "confidence": 0.85,
        "sample_comments": ["Great information!", "Very helpful"],
        "sentiment_breakdown": {"positive": 8, "negative": 1}
      }
    ],
    "top_positive_themes": ["praise", "educational value"],
    "top_negative_themes": ["criticism"],
    "main_topic": "content value",
    "analysis_complete": true
  }
}
```

## Tech Stack

- **FastAPI** - High-performance async web framework
- **VADER** - Rule-based sentiment analysis (instant)
- **YouTube Data API v3** - Official API for fetching comments
- **autocorrect** - Text preprocessing

## Deployment

This is configured for Hugging Face Spaces deployment using Docker SDK.

### Environment Variables

Set these in your Hugging Face Space settings (Settings > Repository secrets):

| Variable | Description |
|----------|-------------|
| `YOUTUBE_API_KEY` | Your YouTube Data API v3 key (required) |

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set your YouTube API key
export YOUTUBE_API_KEY="your-api-key-here"

# Run server
uvicorn app.main:app --reload --port 7860
```

## Hybrid Processing Strategy

For fast UX on free tier:

1. **Instant Layer (VADER)** - Returns within ~1 second with sentiment pie chart
2. **Deep Layer (BART)** - Runs in background, analyzes only top 5-10 most-liked comments
3. **Progressive UI** - Show instant results first, then "pop in" deep insights when ready

## License

MIT
