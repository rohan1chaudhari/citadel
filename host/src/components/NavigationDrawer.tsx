'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export type App = {
  id: string;
  name: string;
  version?: string;
};

interface NavigationDrawerProps {
  apps: App[];
  currentAppId?: string;
}

export function NavigationDrawer({ apps, currentAppId }: NavigationDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer on escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close drawer when clicking on backdrop
  function handleBackdropClick() {
    setIsOpen(false);
  }

  // Close drawer when clicking a link (for navigation)
  function handleLinkClick() {
    setIsOpen(false);
  }

  return (
    <>
      {/* Hamburger Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-30 p-2 rounded-lg bg-white/80 backdrop-blur-sm border border-zinc-200 shadow-sm hover:bg-white hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation drawer"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="font-semibold text-zinc-900">Citadel</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
            aria-label="Close navigation menu"
          >
            <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* App List */}
        <nav className="p-2 overflow-y-auto h-[calc(100%-4rem)]">
          {/* Home Link */}
          <Link
            href="/"
            onClick={handleLinkClick}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
              !currentAppId
                ? 'bg-zinc-900 text-white'
                : 'hover:bg-zinc-100 text-zinc-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              !currentAppId ? 'bg-white/20' : 'bg-zinc-100'
            }`}>
              <svg className={`w-5 h-5 ${!currentAppId ? 'text-white' : 'text-zinc-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">Home</div>
              <div className={`text-xs truncate ${!currentAppId ? 'text-white/70' : 'text-zinc-500'}`}>
                All apps
              </div>
            </div>
          </Link>

          {/* Divider */}
          <div className="my-3 border-t border-zinc-100" />

          {/* Apps */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Apps
            </div>
            {apps.map((app) => (
              <Link
                key={app.id}
                href={`/apps/${app.id}`}
                onClick={handleLinkClick}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                  currentAppId === app.id
                    ? 'bg-zinc-900 text-white'
                    : 'hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={`/app-logos/${app.id}-logo.png`}
                    alt={`${app.name} logo`}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.classList.add('bg-zinc-200', 'flex', 'items-center', 'justify-center');
                        const span = document.createElement('span');
                        span.className = 'text-sm font-bold text-zinc-500';
                        span.textContent = app.name.charAt(0).toUpperCase();
                        parent.appendChild(span);
                      }
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{app.name}</div>
                  <div className={`text-xs truncate ${currentAppId === app.id ? 'text-white/70' : 'text-zinc-500'}`}>
                    {app.id}
                  </div>
                </div>
                {currentAppId === app.id && (
                  <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="my-3 border-t border-zinc-100" />

          {/* Hidden Apps Link */}
          <Link
            href="/hidden"
            onClick={handleLinkClick}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
              currentAppId === 'hidden'
                ? 'bg-zinc-900 text-white'
                : 'hover:bg-zinc-100 text-zinc-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              currentAppId === 'hidden' ? 'bg-white/20' : 'bg-zinc-100'
            }`}>
              <svg className={`w-5 h-5 ${currentAppId === 'hidden' ? 'text-white' : 'text-zinc-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">Hidden Apps</div>
              <div className={`text-xs truncate ${currentAppId === 'hidden' ? 'text-white/70' : 'text-zinc-500'}`}>
                Manage hidden apps
              </div>
            </div>
          </Link>

          {/* Status Link */}
          <Link
            href="/status"
            onClick={handleLinkClick}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
              currentAppId === 'status'
                ? 'bg-zinc-900 text-white'
                : 'hover:bg-zinc-100 text-zinc-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              currentAppId === 'status' ? 'bg-white/20' : 'bg-zinc-100'
            }`}>
              <svg className={`w-5 h-5 ${currentAppId === 'status' ? 'text-white' : 'text-zinc-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">System Status</div>
              <div className={`text-xs truncate ${currentAppId === 'status' ? 'text-white/70' : 'text-zinc-500'}`}>
                Health & diagnostics
              </div>
            </div>
          </Link>
        </nav>
      </aside>
    </>
  );
}
