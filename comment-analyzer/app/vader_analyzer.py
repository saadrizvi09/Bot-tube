"""
VADER Sentiment Analyzer.
Provides instant sentiment analysis (< 1 second for 100 comments).
"""

import logging
from typing import List, Dict, Any, Tuple
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from app.config import get_settings
from app.models import SentimentType, SentimentDistribution

logger = logging.getLogger(__name__)
settings = get_settings()

# Global VADER analyzer instance (lightweight, fast to load)
_vader_analyzer = None


def get_vader_analyzer() -> SentimentIntensityAnalyzer:
    """Get or create VADER analyzer instance with custom lexicon."""
    global _vader_analyzer
    if _vader_analyzer is None:
        logger.info("Initializing VADER analyzer...")
        _vader_analyzer = SentimentIntensityAnalyzer()
        
        # Update lexicon with modern internet slang and specific context fixes
        # VADER misses some modern positive slang unless updated
        new_words = {
            'crushed it': 3.0,
            'killed it': 3.0,
            'nailed it': 3.0,
            'lit': 2.0,
            'fire': 2.0,
            'goat': 3.0,
            'goated': 3.0,
            'based': 2.0,
            'w': 2.0,  # "W" for Win
            'l': -2.0, # "L" for Loss
            'mid': -1.0,
            'peak': 2.5,
            'trash': -3.0,
            'wasted no time': 2.0, # Fix "wasted" being negative
            'no nonsense': 2.0,
            'straight to the point': 2.0,
            'underrated': 2.0,
            'game changer': 2.5,
            'chef kiss': 2.5,
            'chefs kiss': 2.5,
            'miss this': 1.5, # Fix nostalgic "miss" being negative
            'miss the old': 1.0,
            
            # Context-specific fixes for Tutorials/Tech
            'error': -0.1,    # "Compilation error" is tech, not emotion
            'errors': -0.1,
            'bug': -0.2,      # "Fixed a bug" should not be too negative
            'bugs': -0.2,
            'issue': -0.2,
            'issues': -0.2,
            'problem': -0.3,  # Reduce negativity of "problem" to handle "no problem" better
            'hard': -0.2,     # "It was hard" (past tense) isn't hate
            'difficult': -0.2,
            'stuck': -0.2,
            'fail': -0.5,
            'failed': -0.5,
            'fear': -0.5,     # "Fear of learning" -> not hate towards video
            'scared': -0.5,
            'nervous': -0.2,
            'complicated': -0.2,
            'complex': 0.0,
            'cryptic': -0.3,
            'weird': -0.1,
            'hell': -1.0,     # "Tutorial hell" is common phrase
            'insane': 1.5,    # "Insane quality" usually positive on YT
            'crazy': 1.0,
            'monster': 1.0,   # "Content monster"
            'beast': 2.0,
            'nostalgia': 1.5,
            'sick': 2.0,   # Slang for cool
        }
        _vader_analyzer.lexicon.update(new_words)
        
        logger.info("VADER analyzer ready (with slang updates)")
    return _vader_analyzer


def analyze_sentiment(text: str) -> Tuple[SentimentType, float]:
    """
    Analyze sentiment of a single text using VADER.
    
    Returns:
        Tuple of (SentimentType, compound_score)
    """
    analyzer = get_vader_analyzer()
    
    # Get VADER scores
    scores = analyzer.polarity_scores(text)
    compound = scores['compound']
    
    # Classify based on compound score thresholds
    if compound >= settings.VADER_COMPOUND_THRESHOLD_POSITIVE:
        sentiment = SentimentType.POSITIVE
    elif compound <= settings.VADER_COMPOUND_THRESHOLD_NEGATIVE:
        sentiment = SentimentType.NEGATIVE
    else:
        sentiment = SentimentType.NEUTRAL
    
    return sentiment, compound


def analyze_comments_vader(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze sentiment for a list of comments using VADER.
    This is the "instant" layer - completes in < 1 second for 100 comments.
    
    Args:
        comments: List of preprocessed comment dictionaries
        
    Returns:
        Comments with sentiment data added
    """
    analyzer = get_vader_analyzer()
    
    for comment in comments:
        text = comment.get('text_clean', comment.get('text', ''))
        
        if not text:
            comment['sentiment'] = SentimentType.NEUTRAL
            comment['sentiment_score'] = 0.0
            comment['sentiment_scores'] = {'pos': 0, 'neg': 0, 'neu': 1, 'compound': 0}
            continue
        
        # Get full VADER scores
        scores = analyzer.polarity_scores(text)
        compound = scores['compound']
        
        # Classify
        if compound >= settings.VADER_COMPOUND_THRESHOLD_POSITIVE:
            sentiment = SentimentType.POSITIVE
        elif compound <= settings.VADER_COMPOUND_THRESHOLD_NEGATIVE:
            sentiment = SentimentType.NEGATIVE
        else:
            sentiment = SentimentType.NEUTRAL
        
        comment['sentiment'] = sentiment
        comment['sentiment_score'] = compound
        comment['sentiment_scores'] = scores
    
    return comments


def calculate_sentiment_distribution(comments: List[Dict[str, Any]]) -> SentimentDistribution:
    """
    Calculate sentiment distribution statistics from analyzed comments.
    Only considers non-filtered (non-spam/troll) comments.
    """
    # Filter out spam/troll comments for sentiment stats
    valid_comments = [c for c in comments if not c.get('is_filtered', False)]
    
    if not valid_comments:
        return SentimentDistribution(
            positive=0, negative=0, neutral=0,
            positive_percentage=0, negative_percentage=0, neutral_percentage=0,
            average_sentiment=0
        )
    
    # Count sentiments
    positive = sum(1 for c in valid_comments if c.get('sentiment') == SentimentType.POSITIVE)
    negative = sum(1 for c in valid_comments if c.get('sentiment') == SentimentType.NEGATIVE)
    neutral = sum(1 for c in valid_comments if c.get('sentiment') == SentimentType.NEUTRAL)
    
    total = len(valid_comments)
    
    # Calculate percentages
    positive_pct = round((positive / total) * 100, 1) if total > 0 else 0
    negative_pct = round((negative / total) * 100, 1) if total > 0 else 0
    neutral_pct = round((neutral / total) * 100, 1) if total > 0 else 0
    
    # Calculate average sentiment score
    avg_sentiment = sum(c.get('sentiment_score', 0) for c in valid_comments) / total if total > 0 else 0
    
    return SentimentDistribution(
        positive=positive,
        negative=negative,
        neutral=neutral,
        positive_percentage=positive_pct,
        negative_percentage=negative_pct,
        neutral_percentage=neutral_pct,
        average_sentiment=round(avg_sentiment, 3)
    )


def get_extreme_comments(
    comments: List[Dict[str, Any]], 
    sentiment: SentimentType, 
    n: int = 5
) -> List[Dict[str, Any]]:
    """
    Get the most extreme comments of a given sentiment.
    
    Args:
        comments: Analyzed comments
        sentiment: Target sentiment type
        n: Number of comments to return
        
    Returns:
        List of most extreme comments sorted by sentiment score
    """
    # Filter to target sentiment and non-filtered comments
    filtered = [
        c for c in comments 
        if c.get('sentiment') == sentiment and not c.get('is_filtered', False)
    ]
    
    # Sort by absolute sentiment score (most extreme first)
    if sentiment == SentimentType.POSITIVE:
        sorted_comments = sorted(filtered, key=lambda x: x.get('sentiment_score', 0), reverse=True)
    elif sentiment == SentimentType.NEGATIVE:
        sorted_comments = sorted(filtered, key=lambda x: x.get('sentiment_score', 0))
    else:
        # For neutral, sort by how close to 0 the compound score is
        sorted_comments = sorted(filtered, key=lambda x: abs(x.get('sentiment_score', 0)))
    
    return sorted_comments[:n]


def get_vader_summary(comments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Get a complete VADER analysis summary.
    """
    # Run VADER analysis
    analyzed = analyze_comments_vader(comments)
    
    # Get distribution
    distribution = calculate_sentiment_distribution(analyzed)
    
    # Get extreme comments
    top_positive = get_extreme_comments(analyzed, SentimentType.POSITIVE, 5)
    top_negative = get_extreme_comments(analyzed, SentimentType.NEGATIVE, 5)
    
    # Determine overall vibe
    if distribution.average_sentiment >= 0.2:
        overall_vibe = "Very Positive 🎉"
    elif distribution.average_sentiment >= 0.05:
        overall_vibe = "Positive 😊"
    elif distribution.average_sentiment <= -0.2:
        overall_vibe = "Very Negative 😠"
    elif distribution.average_sentiment <= -0.05:
        overall_vibe = "Negative 😞"
    else:
        overall_vibe = "Mixed/Neutral 😐"
    
    return {
        'comments': analyzed,
        'distribution': distribution,
        'top_positive': top_positive,
        'top_negative': top_negative,
        'overall_vibe': overall_vibe
    }
