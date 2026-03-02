'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface App {
  id: string;
  name: string;
}

interface NavDrawerProps {
  apps: App[];
  hiddenApps?: string[];
}

interface AuthStatus {
  enabled: boolean;
  authenticated: boolean;
}

export function NavDrawer({ apps, hiddenApps = [] }: NavDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch auth status
  useEffect(() => {
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setAuthStatus({
            enabled: data.enabled,
            authenticated: data.authenticated,
          });
        }
      })
      .catch(() => {
        // Auth endpoint may not exist in older versions
        setAuthStatus({ enabled: false, authenticated: true });
      });
  }, []);

  // Close drawer when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const visibleApps = apps.filter(app => !hiddenApps.includes(app.id));

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hover:bg-zinc-50 transition"
        aria-label="Toggle navigation"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside className={`fixed top-0 left-0 h-full bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isMobile ? 'w-64' : 'w-72'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-lg font-semibold text-zinc-900">
                Citadel
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-zinc-100"
                aria-label="Close drawer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* App list */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="px-4 mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Apps
            </div>
            
            {visibleApps.map((app) => (
              <Link
                key={app.id}
                href={`/apps/${app.id}`}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition ${
                  pathname === `/apps/${app.id}`
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={`/app-logos/${app.id}-logo.png`}
                    alt={app.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="font-medium truncate">{app.name}</span>
              </Link>
            ))}

            {hiddenApps.length > 0 && (
              <>
                <div className="px-4 mt-6 mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Hidden
                </div>
                <Link
                  href="/hidden"
                  className="flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-zinc-500 hover:bg-zinc-50 transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  </div>
                  <span className="font-medium">Hidden Apps</span>
                </Link>
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-200">
            <Link
              href="/browse"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-zinc-500 hover:bg-zinc-50 transition mb-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="font-medium">Browse Apps</span>
            </Link>
            <Link
              href="/workflows"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-zinc-500 hover:bg-zinc-50 transition mb-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium">Workflows</span>
            </Link>
            <Link
              href="/audit"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-zinc-500 hover:bg-zinc-50 transition mb-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span className="font-medium">Audit Logs</span>
            </Link>
            <Link
              href="/status"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-zinc-500 hover:bg-zinc-50 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="font-medium">System Status</span>
            </Link>
            
            {/* Logout button - only shown when auth is enabled */}
            {authStatus?.enabled && authStatus?.authenticated && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-zinc-500 hover:bg-zinc-50 transition mt-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-medium">Logout</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Spacer for main content when drawer is open on desktop */}
      {!isMobile && isOpen && <div className="w-72 flex-shrink-0" />}
    </>
  );
}
