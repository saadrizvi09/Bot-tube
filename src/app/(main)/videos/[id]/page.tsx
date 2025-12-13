'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ArrowLeftIcon, TrashIcon, ChatBubbleBottomCenterTextIcon, SparklesIcon, Bars3Icon } from '@heroicons/react/24/outline';

// --- Interfaces (no change) ---
interface Video {
  id: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  duration: number;
  createdAt: string;
}
interface Question {
  id: string;
  question: string;
  answer: string;
  context: any[];
  createdAt: string;
}

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;
  
  const [video, setVideo] = useState<Video | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoToDeleteId, setVideoToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideoData = async () => {
      if (!videoId) return;
      try {
        const [videoResponse, questionsResponse] = await Promise.all([
          fetch(`/api/videos/${videoId}`),
          fetch(`/api/videos/${videoId}/questions`)
        ]);

        if (videoResponse.status === 404) {
          router.push('/dashboard');
          return;
        }
        if (!videoResponse.ok) throw new Error('Failed to fetch video details');
        if (!questionsResponse.ok) throw new Error('Failed to fetch questions');

        const videoData = await videoResponse.json();
        const questionsData = await questionsResponse.json();

        setVideo(videoData);
        setQuestions(questionsData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setPageLoading(false);
      }
    };
    fetchVideoData();
  }, [videoId, router]);

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/videos/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, question: newQuestion }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to answer question');
      
      setQuestions([data, ...questions]);
      setCurrentQuestion(data);
      setNewQuestion('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVideo = () => {
    setVideoToDeleteId(videoId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!videoToDeleteId) return;
    setShowDeleteModal(false);
    try {
      const response = await fetch(`/api/videos/${videoToDeleteId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete video');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  // --- Beautiful Loading State ---
  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative z-10 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
          <p className="text-xl text-gray-300">Loading video details...</p>
        </div>
      </div>
    );
  }

  // --- Beautiful Error State ---
  if (error && !video) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-red-500/10 border border-red-500/20 rounded-lg p-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xl text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!video) return null; // Should be handled by loading/error states

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* --- Header --- */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200 truncate max-w-2xl">
          {video.title}
        </h1>
        <div className="flex-shrink-0 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
          <button onClick={handleDeleteVideo} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-colors">
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* --- Main Content (Left Column) --- */}
        <div className="lg:col-span-2 space-y-8">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="aspect-video bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${video.videoId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
          
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <ChatBubbleBottomCenterTextIcon className="h-6 w-6 text-blue-400" />
              Ask a Question
            </h2>
            <form onSubmit={handleSubmitQuestion} className="space-y-4">
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Ask anything about this video..."
                rows={3}
                className="block w-full rounded-lg border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm"
                disabled={isLoading}
              />
              {error && (
                <div className="flex items-center gap-3 rounded-md bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading || !newQuestion.trim()}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 transition-all transform hover:scale-[1.01]"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Thinking...
                  </>
                ) : 'Ask Question'}
              </button>
            </form>
          </div>
          
          {currentQuestion && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6 animate-fadeIn">
              <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                <SparklesIcon className="h-6 w-6 text-purple-400" />
                AI Answer
              </h2>
              <div className="bg-blue-500/10 rounded-lg p-4 mb-4 border border-blue-500/20">
                <p className="font-medium text-white">{currentQuestion.question}</p>
              </div>
              <div className="prose prose-invert prose-sm md:prose-base max-w-none prose-headings:text-white prose-p:text-gray-200 prose-strong:text-white prose-em:text-gray-300 prose-code:text-blue-300 prose-code:bg-blue-900/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:border prose-pre:border-white/10 prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-ul:text-gray-200 prose-ol:text-gray-200 prose-li:text-gray-200">
                <ReactMarkdown
                  components={{
                    p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                    ul: ({node, ...props}) => <ul className="mb-3 list-disc pl-5 space-y-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="mb-3 list-decimal pl-5 space-y-1" {...props} />,
                    li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                    em: ({node, ...props}) => <em className="italic text-gray-300" {...props} />,
                    code: ({node, className, children, ...props}) => {
                      const inline = !className;
                      return inline ? (
                        <code className="bg-blue-900/30 text-blue-300 px-1 py-0.5 rounded text-sm" {...props}>{children}</code>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    },
                  }}
                >
                  {currentQuestion.answer}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
        
        {/* --- Previous Questions (Right Column) --- */}
        <div className="lg:col-span-1">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6 sticky top-8">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <Bars3Icon className="h-6 w-6 text-gray-300" />
              Question History
            </h2>
            {questions.length === 0 ? (
              <div className="text-center py-10">
                <ChatBubbleBottomCenterTextIcon className="h-12 w-12 mx-auto text-gray-500" />
                <p className="text-gray-400 mt-4">No questions asked yet.</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 -mr-2 custom-scrollbar">
                {questions.map((q, index) => (
                  <li key={`${q.id}-${index}`}>
                    <button onClick={() => setCurrentQuestion(q)} className="text-left w-full transition-all duration-200 hover:bg-white/10 p-3 rounded-lg">
                      <p className="font-medium text-blue-400 truncate">{q.question}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 max-w-sm w-full text-center">
            <TrashIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-4">Confirm Deletion</h3>
            <p className="text-gray-300 mb-6">Are you sure you want to delete this video? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-5 py-2 rounded-lg text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}