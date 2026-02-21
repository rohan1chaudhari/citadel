'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState } from 'react';

type App = {
  id: string;
  name: string;
  version?: string;
};

export function AppGrid({ apps: initialApps }: { apps: App[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initialApps);
  const [hiding, setHiding] = useState<string | null>(null);

  async function hideApp(appId: string) {
    setHiding(appId);
    try {
      const res = await fetch('/api/apps/citadel/hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== appId));
        router.refresh();
      }
    } finally {
      setHiding(null);
    }
  }

  return (
    <>
      {/* Icon grid - 3x4 layout */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
        {apps.map((a) => (
          <div key={a.id} className="group flex flex-col items-center text-center relative">
            <a href={`/apps/${a.id}`} className="flex flex-col items-center text-center">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-200 group-hover:scale-105">
                <Image
                  src={`/app-logos/${a.id}-logo.png`}
                  alt={`${a.name}`}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="mt-2 text-xs sm:text-sm font-medium text-zinc-900 group-hover:text-zinc-700 truncate max-w-full px-1">
                {a.name}
              </div>
            </a>
            {/* Hide button */}
            <button
              onClick={() => hideApp(a.id)}
              disabled={hiding === a.id}
              className="absolute -top-1 -right-1 w-6 h-6 bg-zinc-100 hover:bg-zinc-200 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              title="Hide app"
            >
              {hiding === a.id ? (
                <span className="text-xs">⋯</span>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        ))}

        {/* Empty slots to fill 3x4 grid if needed */}
        {Array.from({ length: Math.max(0, 12 - apps.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex flex-col items-center text-center opacity-30"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-dashed border-zinc-300 flex items-center justify-center">
              <span className="text-2xl text-zinc-300">+</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400">Slot {apps.length + i + 1}</div>
          </div>
        ))}
      </div>

      {/* Hidden apps link */}
      <div className="mt-6 flex justify-center">
        <a
          href="/hidden"
          className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
          View Hidden Apps
        </a>
      </div>
    </>
  );
}
