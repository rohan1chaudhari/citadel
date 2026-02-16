import { Card, LinkA, Shell } from '@/components/Shell';
import { GymTrackerClient } from './GymTrackerClient';

export const runtime = 'nodejs';

type Entry = {
  id: number;
  date: string | null;
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

async function fetchEntries() {
  const res = await fetch('http://localhost:3000/api/apps/gym-tracker/entries', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as { ok: true; entries: Entry[]; recentExercises: string[] };
}

export default async function GymTrackerPage() {
  const data = await fetchEntries();

  return (
    <Shell title="Gym Tracker" subtitle="Fast logging with reusable defaults and inline edits.">
      <div className="flex items-center justify-between">
        <LinkA href="/">← home</LinkA>
        <div className="text-xs text-zinc-500">{data.entries.length} entries</div>
      </div>

      <GymTrackerClient initialEntries={data.entries} recentExercises={data.recentExercises} />

      <Card>
        <div className="text-sm text-zinc-600">
          <LinkA href="/api/apps/gym-tracker/health" target="_blank" rel="noreferrer">health</LinkA>
          {' · '}
          <LinkA href="/api/apps/gym-tracker/selftest" target="_blank" rel="noreferrer">selftest</LinkA>
        </div>
      </Card>
    </Shell>
  );
}
