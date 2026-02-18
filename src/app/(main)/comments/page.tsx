"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

// Types for the API responses
interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
  positive_percentage: number;
  negative_percentage: number;
  neutral_percentage: number;
  average_sentiment: number;
}

interface FilteredStats {
  total_filtered: number;
  spam_count: number;
  troll_count: number;
  spam_percentage: number;
  troll_percentage: number;
}

interface CommentData {
  id: string;
  text: string;
  text_clean: string;
  author: string;
  likes: number;
  reply_count: number;
  sentiment: "positive" | "negative" | "neutral";
  sentiment_score: number;
  comment_type: "normal" | "spam" | "troll";
  is_filtered: boolean;
}

interface InstantAnalysisResponse {
  video_id: string;
  video_title: string | null;
  total_comments: number;
  analyzed_comments: number;
  sentiment_distribution: SentimentDistribution;
  filtered_stats: FilteredStats;
  top_positive_comments: CommentData[];
  top_negative_comments: CommentData[];
  processing_time_ms: number;
}

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_COMMENT_ANALYZER_URL || "http://localhost:7860";

// Color scheme
const COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
};

export default function CommentAnalyzerPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [maxComments, setMaxComments] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Analysis results
  const [instantResult, setInstantResult] = useState<InstantAnalysisResponse | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoUrl.trim()) {
      setError("Please enter a YouTube video URL");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setInstantResult(null);
    
    console.log('[Comment Analyzer] Calling API:', `${API_BASE_URL}/analyze`);
    console.log('[Comment Analyzer] Request body:', { video_url: videoUrl, max_comments: maxComments });
    
    try {
      const response = await fetch(`${API_BASE_URL}/analyze?_t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify({
          video_url: videoUrl,
          max_comments: maxComments,
          include_replies: false,
        }),
      });
      
      console.log('[Comment Analyzer] Response status:', response.status);
      console.log('[Comment Analyzer] Response ok:', response.ok);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Server returned ${response.status}` }));
        console.error('[Comment Analyzer] Error response:', errorData);
        throw new Error(errorData.error || "Analysis failed");
      }
      
      const data: InstantAnalysisResponse = await response.json();
      console.log('[Comment Analyzer] Success! Analyzed', data.analyzed_comments, 'comments');
      setInstantResult(data);
      
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError(`Cannot connect to API server. Please ensure the backend is running at: ${API_BASE_URL}`);
      } else {
        setError(err instanceof Error ? err.message : "Analysis failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare chart data
  const pieChartData = instantResult ? [
    { name: "Positive", value: instantResult.sentiment_distribution.positive, color: COLORS.positive },
    { name: "Negative", value: instantResult.sentiment_distribution.negative, color: COLORS.negative },
    { name: "Neutral", value: instantResult.sentiment_distribution.neutral, color: COLORS.neutral },
  ] : [];

  const getVibeEmoji = (avgSentiment: number) => {
    if (avgSentiment >= 0.2) return "🎉";
    if (avgSentiment >= 0.05) return "😊";
    if (avgSentiment <= -0.2) return "😠";
    if (avgSentiment <= -0.05) return "😞";
    return "😐";
  };

  const getVibeText = (avgSentiment: number) => {
    if (avgSentiment >= 0.2) return "Very Positive";
    if (avgSentiment >= 0.05) return "Positive";
    if (avgSentiment <= -0.2) return "Very Negative";
    if (avgSentiment <= -0.05) return "Negative";
    return "Mixed/Neutral";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">YouTube Comment Analyzer 📊</h1>
          <p className="text-gray-400">
            Analyze sentiment and detect spam in video comments
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Paste YouTube video URL..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
              />
            </div>
            <div className="w-32">
              <select
                value={maxComments}
                onChange={(e) => setMaxComments(Number(e.target.value))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
              >
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={75}>75</option>
                <option value={100}>100</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              {isLoading ? "Analyzing..." : "Analyze"}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
              {error}
            </div>
          )}
        </form>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Fetching and analyzing comments...</p>
          </div>
        )}

        {/* Results */}
        {instantResult && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Comments</p>
                <p className="text-2xl font-bold">{instantResult.total_comments}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Analyzed</p>
                <p className="text-2xl font-bold">{instantResult.analyzed_comments}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Filtered (Spam/Troll)</p>
                <p className="text-2xl font-bold text-yellow-500">{instantResult.filtered_stats.total_filtered}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Analysis Time</p>
                <p className="text-2xl font-bold">{instantResult.processing_time_ms.toFixed(0)}ms</p>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sentiment Chart */}
              <div className="bg-gray-800 rounded-lg p-6 lg:col-span-2">
                <h2 className="text-xl font-semibold mb-4">Sentiment Distribution</h2>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="h-64 w-full md:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center w-full md:w-1/2">
                    <span className="text-6xl block mb-4">{getVibeEmoji(instantResult.sentiment_distribution.average_sentiment)}</span>
                    <p className="text-xl font-semibold">{getVibeText(instantResult.sentiment_distribution.average_sentiment)}</p>
                    <p className="text-gray-400 mt-2">Average Score: {instantResult.sentiment_distribution.average_sentiment.toFixed(3)}</p>
                    <p className="text-gray-500 text-sm mt-4">
                      Based on VADER sentiment analysis
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Comments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Positive */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-green-400">Top Positive Comments 👍</h2>
                <div className="space-y-3">
                  {instantResult.top_positive_comments.map((comment, i) => (
                    <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-sm text-gray-300">{comment.text_clean}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>👤 {comment.author}</span>
                        <span>👍 {comment.likes}</span>
                        <span className="text-green-400">Score: {comment.sentiment_score.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Negative */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-red-400">Top Negative Comments 👎</h2>
                <div className="space-y-3">
                  {instantResult.top_negative_comments.map((comment, i) => (
                    <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-sm text-gray-300">{comment.text_clean}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>👤 {comment.author}</span>
                        <span>👍 {comment.likes}</span>
                        <span className="text-red-400">Score: {comment.sentiment_score.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Stats */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Spam & Troll Filter Results 🛡️</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-500">{instantResult.filtered_stats.total_filtered}</p>
                  <p className="text-gray-400 text-sm">Total Filtered</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500">{instantResult.filtered_stats.spam_count}</p>
                  <p className="text-gray-400 text-sm">Spam ({instantResult.filtered_stats.spam_percentage}%)</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-500">{instantResult.filtered_stats.troll_count}</p>
                  <p className="text-gray-400 text-sm">Troll ({instantResult.filtered_stats.troll_percentage}%)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
