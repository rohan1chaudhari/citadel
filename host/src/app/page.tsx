import { Card, LinkA, Shell } from '@/components/Shell';
import { listApps } from '@/lib/registry';
import Image from 'next/image';

export const runtime = 'nodejs';

export default async function HomePage() {
  const apps = await listApps();

  return (
    <Shell title="Citadel" subtitle="Your local-first app hub">
      {/* Icon grid - 3x4 layout */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
        {apps.map((a) => (
          <a
            key={a.id}
            href={`/apps/${a.id}`}
            className="group flex flex-col items-center text-center"
          >
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

      <Card className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            {apps.length} app{apps.length === 1 ? '' : 's'} installed
          </div>
          <LinkA href="/status">View System Status →</LinkA>
        </div>
      </Card>
    </Shell>
  );
}
