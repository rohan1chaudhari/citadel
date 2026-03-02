import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import './globals.css';
import { NavigationDrawer } from '@/components/NavigationDrawer';
import { listApps } from '@citadel/core';
import { cleanupOldAuditLogs } from '@citadel/core';
import { runAllMigrations } from '@citadel/core';
import { startBackupScheduler, runBackupIfNeeded } from '@/lib/backup';
import { startStuckTaskWatcher } from '@/lib/stuckTaskWatcher';
import { ThemeProvider } from '@/lib/theme';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#3b82f6'
};

export const metadata = {
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192' }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Citadel'
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const apps = await listApps(false);

  // Run migrations for all apps on startup
  runAllMigrations().catch(err => console.error('Migration error:', err));

  // Run audit log cleanup on startup (server-side only)
  cleanupOldAuditLogs();

  // Start backup scheduler (runs immediately and every 24h)
  startBackupScheduler();

  // Sweep stale in_progress tasks (runs immediately and every 10m)
  startStuckTaskWatcher();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Citadel" />
        <ThemeScript />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        <ThemeProvider>
          <NavigationDrawer apps={apps} />
          <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-3 sm:px-4 md:px-6 pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-4 md:pt-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-6 md:py-8">
            {children}
          </div>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' ? <ServiceWorkerRegistration /> : null}
      </body>
    </html>
  );
}

// Theme initialization script - runs before React hydration to prevent flash
function ThemeScript() {
  const themeScript = `
    (function() {
      function getTheme() {
        try {
          var stored = localStorage.getItem('citadel-theme');
          if (stored === 'dark' || stored === 'light') return stored;
        } catch (e) {}
        return 'system';
      }
      
      function getSystemIsDark() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      
      var theme = getTheme();
      var isDark = theme === 'dark' || (theme === 'system' && getSystemIsDark());
      
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: themeScript
      }}
    />
  );
}

// Client component for service worker registration
function ServiceWorkerRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(
                function(registration) {
                  console.log('ServiceWorker registration successful');
                },
                function(err) {
                  console.log('ServiceWorker registration failed: ', err);
                }
              );
            });
          }
        `
      }}
    />
  );
}
