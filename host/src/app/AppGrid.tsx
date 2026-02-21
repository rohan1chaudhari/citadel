'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useRef, useCallback } from 'react';

type App = {
  id: string;
  name: string;
  version?: string;
};

export function AppGrid({ apps: initialApps }: { apps: App[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initialApps);
  const [hiding, setHiding] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ appId: string; x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  async function hideApp(appId: string) {
    setHiding(appId);
    setContextMenu(null);
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

  // Touch handlers for long press
  const handleTouchStart = useCallback((appId: string) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      // Show context menu at center of screen for mobile
      setContextMenu({ appId, x: 0, y: 0 });
    }, 500); // 500ms for long press
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, appId: string) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    // If it was a long press, prevent navigation
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Right click handler
  const handleContextMenu = useCallback((e: React.MouseEvent, appId: string) => {
    e.preventDefault();
    setContextMenu({ appId, x: e.clientX, y: e.clientY });
  }, []);

  const handleAppClick = useCallback((e: React.MouseEvent | React.TouchEvent, appId: string) => {
    // If context menu is open or it was a long press, don't navigate
    if (contextMenu || isLongPress.current) {
      e.preventDefault();
      return;
    }
    router.push(`/apps/${appId}`);
  }, [contextMenu, router]);

  // Close context menu when clicking elsewhere
  const handleBackdropClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <>
      {/* Icon grid - 3x4 layout */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
        {apps.map((a) => (
          <div 
            key={a.id} 
            className="group flex flex-col items-center text-center relative select-none"
            onContextMenu={(e) => handleContextMenu(e, a.id)}
            onTouchStart={() => handleTouchStart(a.id)}
            onTouchEnd={(e) => handleTouchEnd(e, a.id)}
            onTouchMove={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            }}
          >
            <div 
              className="flex flex-col items-center text-center cursor-pointer"
              onClick={(e) => handleAppClick(e, a.id)}
            >
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-200 group-hover:scale-105">
                <Image
                  src={`/app-logos/${a.id}-logo.png`}
                  alt={`${a.name}`}
                  fill
                  className="object-cover"
                  draggable={false}
                />
              </div>
              <div className="mt-2 text-xs sm:text-sm font-medium text-zinc-900 group-hover:text-zinc-700 truncate max-w-full px-1">
                {a.name}
              </div>
            </div>
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

      {/* Context Menu / Long Press Menu */}
      {contextMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={handleBackdropClick}
          />
          
          {/* Menu */}
          <div 
            className={`fixed z-50 bg-white rounded-lg shadow-xl border border-zinc-200 py-1 min-w-[140px] ${
              contextMenu.x === 0 && contextMenu.y === 0 
                ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2' 
                : ''
            }`}
            style={
              contextMenu.x !== 0 || contextMenu.y !== 0 
                ? { top: contextMenu.y, left: contextMenu.x } 
                : undefined
            }
          >
            <button
              onClick={() => hideApp(contextMenu.appId)}
              disabled={hiding === contextMenu.appId}
              className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 flex items-center gap-2 transition-colors"
            >
              {hiding === contextMenu.appId ? (
                <span>⋯</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Hide App
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Hidden apps link */}
      <div className="mt-6 flex justify-center">
        <a
          href="/hidden"
          className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
          View Hidden Apps
        </a>
      </div>
    </>
  );
}
