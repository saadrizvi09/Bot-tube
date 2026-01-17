'use client';

import { Inter } from 'next/font/google';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

// Helper for conditional class names
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={`${inter.className} min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 relative`}>
      {/* Animated background elements from your dashboard */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Sticky Header with Glassmorphism Effect */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gray-900/60 border-b border-white/10 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo / Brand Name with Gradient Text */}
            <Link href="/dashboard" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-300 hover:from-white hover:to-blue-400 transition-all">
              YouTube Q&A
            </Link>

            {/* Navigation Links */}
            <nav className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  pathname === '/dashboard'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                Dashboard
              </Link>
              <Link
                href="/videos/new"
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  pathname === '/videos/new'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                Add Video
              </Link>
              <Link
                href="/comments"
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  pathname === '/comments'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                Comment Analyzer
              </Link>

              {/* Styled Logout Button */}
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="group flex items-center gap-2 rounded-md bg-red-600/80 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-red-600 hover:scale-105"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  Sign Out
                </button>
              </form>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}