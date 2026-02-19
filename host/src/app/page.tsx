import { Card, LinkA, Shell } from '@/components/Shell';
import { listApps } from '@/lib/registry';
import Image from 'next/image';

export const runtime = 'nodejs';

export default async function HomePage() {
  const apps = await listApps();

  return (
    <Shell title="Home" subtitle="Your local-first app hub">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((a) => (
          <a
            key={a.id}
            href={`/apps/${a.id}`}
            className="group rounded-xl border border-zinc-200 bg-white overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="relative w-full h-[150px]">
              <Image
                src={`/app-heroes/${a.id}.svg`}
                alt={`${a.name} hero image`}
                fill
                className="object-cover"
              />
            </div>
            <div className="p-3">
              <div className="text-sm font-medium text-zinc-900 group-hover:text-zinc-700">{a.name}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {a.id}{a.version ? ` · v${a.version}` : ''}
              </div>
            </div>
          </a>
        ))}
      </div>

      <Card className="mt-6">
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
