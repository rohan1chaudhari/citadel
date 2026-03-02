'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Inline SVG icons
const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" x2="12" y1="9" y2="13"/>
    <line x1="12" x2="12.01" y1="17" y2="17"/>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const BugIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m8 2 1.88 1.88"/>
    <path d="M14.12 3.88 16 2"/>
    <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
    <path d="M12 20v-9"/>
    <path d="M6.53 9C4.6 8.8 3 7.1 3 5"/>
    <path d="M6 13H2"/>
    <path d="M3 21c0-2.1 1.7-3.9 3.8-4"/>
    <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/>
    <path d="M22 13h-4"/>
    <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>
  </svg>
);

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console for visibility
    const isDev = process.env.NODE_ENV === 'development';
    
    console.error('[Error Boundary]', {
      message: error.message,
      digest: error.digest,
      stack: isDev ? error.stack : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      timestamp: new Date().toISOString(),
    });

    // Send error to server for audit logging (async, don't block)
    if (typeof window !== 'undefined') {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          stack: isDev ? error.stack : undefined,
          url: window.location.href,
          digest: error.digest,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        // Silently fail if error logging fails
      });
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400">
        <AlertTriangleIcon />
      </div>
      
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
        Oops!
      </h1>
      
      <h2 className="mb-4 text-xl font-semibold text-zinc-700 dark:text-zinc-300">
        Something Went Wrong
      </h2>
      
      <p className="mb-8 max-w-md text-zinc-600 dark:text-zinc-400">
        An unexpected error occurred. Try refreshing the page or go back home.
      </p>

      {process.env.NODE_ENV === 'development' && (
        <div className="mb-8 w-full max-w-2xl overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10">
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-100 px-4 py-2 dark:border-red-800 dark:bg-red-900/20">
            <BugIcon />
            <span className="text-sm font-medium text-red-800 dark:text-red-300">
              Error Details (Development Only)
            </span>
          </div>
          <div className="max-h-48 overflow-auto p-4">
            <p className="mb-2 font-mono text-sm text-red-700 dark:text-red-400">
              {error.message}
            </p>
            {error.digest && (
              <p className="mb-2 text-xs text-red-600 dark:text-red-500">
                Digest: {error.digest}
              </p>
            )}
            {error.stack && (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-red-600 dark:text-red-500">
                {error.stack}
              </pre>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <RefreshIcon />
          Try Again
        </button>
        
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <HomeIcon />
          Go Home
        </Link>
      </div>

      <div className="mt-12 text-sm text-zinc-500 dark:text-zinc-500">
        <p>Error ID: {error.digest || 'unknown'}</p>
      </div>
    </div>
  );
}
