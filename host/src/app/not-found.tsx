'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Inline SVG icons
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const AlertCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" x2="12" y1="8" y2="12"/>
    <line x1="12" x2="12.01" y1="16" y2="16"/>
  </svg>
);

export default function NotFound() {
  useEffect(() => {
    // Log 404 errors to audit in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.log('[404] Page not found:', window.location.pathname);
    }
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
        <SearchIcon />
      </div>
      
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
        404
      </h1>
      
      <h2 className="mb-4 text-xl font-semibold text-zinc-700 dark:text-zinc-300">
        Page Not Found
      </h2>
      
      <p className="mb-8 max-w-md text-zinc-600 dark:text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist or has been moved. 
        Check the URL or navigate back home.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <HomeIcon />
          Go Home
        </Link>
        
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Go Back
        </button>
      </div>

      <div className="mt-12 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
        <AlertCircleIcon />
        <span>If you believe this is an error, please check the URL and try again.</span>
      </div>
    </div>
  );
}
