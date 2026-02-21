import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import './globals.css';
import { NavigationDrawer } from '@/components/NavigationDrawer';
import { listApps } from '@/lib/registry';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const apps = await listApps(false);

  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden">
        <NavigationDrawer apps={apps} />
        <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] md:px-4 md:py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
