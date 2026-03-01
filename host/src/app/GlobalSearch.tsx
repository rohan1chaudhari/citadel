'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type App = {
  id: string;
  name: string;
  description?: string;
};

type SearchResult = {
  type: 'app';
  id: string;
  name: string;
  description?: string;
  href: string;
};

export function GlobalSearch({ apps }: { apps: App[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Handle keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search results (client-side search of apps)
  const results = useMemo(() => {
    if (!query.trim()) return [];
    
    const q = query.toLowerCase();
    const matched: SearchResult[] = [];

    for (const app of apps) {
      const nameMatch = app.name.toLowerCase().includes(q);
      const descMatch = app.description?.toLowerCase().includes(q);
      
      if (nameMatch || descMatch) {
        matched.push({
          type: 'app',
          id: app.id,
          name: app.name,
          description: app.description,
          href: `/apps/${app.id}`,
        });
      }
    }

    return matched;
  }, [query, apps]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + Math.max(1, results.length)) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        router.push(selected.href);
        setIsOpen(false);
      }
    }
  }, [results, selectedIndex, router]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
  };

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">Search apps...</span>
        <span className="sm:hidden">Search...</span>
        <kbd className="hidden sm:inline-flex ml-2 px-1.5 py-0.5 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 rounded">
          ⌘K
        </kbd>
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
          
          {/* Search modal */}
          <div 
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search apps..."
                className="flex-1 bg-transparent outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                autoFocus
              />
              <kbd className="px-2 py-1 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {query.trim() && results.length === 0 ? (
                <div className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  <svg className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No apps found matching &quot;{query}&quot;</p>
                </div>
              ) : query.trim() ? (
                <ul className="py-2">
                  {results.map((result, index) => (
                    <li key={result.id}>
                      <button
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          index === selectedIndex
                            ? 'bg-zinc-100 dark:bg-zinc-800'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={`/app-logos/${result.id}-logo.png`}
                            alt={result.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {result.name}
                          </p>
                          {result.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                              {result.description}
                            </p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                  <p className="text-sm">Start typing to search apps</p>
                  <p className="text-xs mt-1 text-zinc-400 dark:text-zinc-500">
                    Search by app name or description
                  </p>
                </div>
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 font-mono bg-white dark:bg-zinc-800 rounded">↑</kbd>
                  <kbd className="px-1 py-0.5 font-mono bg-white dark:bg-zinc-800 rounded">↓</kbd>
                  <span className="ml-1">navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 font-mono bg-white dark:bg-zinc-800 rounded">↵</kbd>
                  <span className="ml-1">select</span>
                </span>
              </div>
              <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
