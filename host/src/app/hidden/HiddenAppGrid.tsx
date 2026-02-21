'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState } from 'react';

type App = {
  id: string;
  name: string;
  version?: string;
};

export function HiddenAppGrid({ apps: initialApps }: { apps: App[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initialApps);
  const [unhiding, setUnhiding] = useState<string | null>(null);

  async function unhideApp(appId: string) {
    setUnhiding(appId);
    try {
      const res = await fetch('/api/apps/citadel/hidden', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== appId));
        router.refresh();
      }
    } finally {
      setUnhiding(null);
    }
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
      {apps.map((a) => (
        <div key={a.id} className="group flex flex-col items-center text-center relative">
          <a href={`/apps/${a.id}`} className="flex flex-col items-center text-center opacity-75 hover:opacity-100 transition-opacity">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-200 group-hover:scale-105">
              <Image
                src={`/app-logos/${a.id}-logo.png`}
                alt={`${a.name}`}
                fill
                className="object-cover"
              />
              {/* Hidden overlay */}
              <div className="absolute inset-0 bg-zinc-900/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </div>
            </div>
            <div className="mt-2 text-xs sm:text-sm font-medium text-zinc-700 truncate max-w-full px-1">
              {a.name}
            </div>
          </a>
          {/* Unhide button */}
          <button
            onClick={() => unhideApp(a.id)}
            disabled={unhiding === a.id}
            className="mt-2 px-3 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full transition-colors flex items-center gap-1"
          >
            {unhiding === a.id ? (
              <>⋯</>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Unhide
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
