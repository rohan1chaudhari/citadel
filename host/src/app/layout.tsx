import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden">
        <div className="mx-auto w-full max-w-3xl px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] md:px-4 md:py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
