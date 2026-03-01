'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 text-6xl">📡</div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        You&apos;re Offline
      </h1>
      <p className="mb-6 max-w-md text-slate-600 dark:text-slate-400">
        It looks like you&apos;ve lost your internet connection. 
        Some features may be unavailable until you reconnect.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 active:bg-blue-800"
      >
        Try Again
      </button>
    </div>
  );
}
