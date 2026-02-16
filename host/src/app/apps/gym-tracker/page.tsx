import { Button, Card, Input, Label, LinkA, Shell } from '@/components/Shell';

type Entry = {
  id: number;
  date: string;
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  created_at: string;
};

async function fetchEntries() {
  const res = await fetch('http://localhost:3000/api/apps/gym-tracker/entries', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as { ok: true; entries: Entry[] };
}

export default async function GymTrackerPage() {
  const data = await fetchEntries();

  return (
    <Shell title="Gym Tracker" subtitle="Minimal logging to prove DB + storage isolation.">
      <div className="flex items-center justify-between">
        <LinkA href="/">← home</LinkA>
        <div className="text-xs text-zinc-500">{data.entries.length} entries</div>
      </div>

      <div className="grid gap-6">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">New entry</h2>
              <p className="mt-1 text-sm text-zinc-600">This writes to the gym-tracker SQLite DB and touches app storage.</p>
            </div>
            <div className="text-xs text-zinc-500">MVP 2</div>
          </div>

          <form action="/api/apps/gym-tracker/entries" method="post" className="mt-4 grid gap-3">
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" />
            </div>

            <div>
              <Label>Exercise</Label>
              <Input name="exercise" placeholder="Bench press" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Sets</Label>
                <Input name="sets" type="number" min="0" step="1" placeholder="3" />
              </div>
              <div>
                <Label>Reps</Label>
                <Input name="reps" type="number" min="0" step="1" placeholder="8" />
              </div>
              <div>
                <Label>Weight</Label>
                <Input name="weight" type="number" min="0" step="0.5" placeholder="80" />
              </div>
            </div>

            <div>
              <Button type="submit">Add</Button>
            </div>
          </form>
        </Card>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Recent</h2>
            <div className="text-xs text-zinc-500">Newest first</div>
          </div>
          <div className="mt-3 grid gap-3">
            {data.entries.map((e) => (
              <Card key={e.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{e.exercise}</div>
                    <div className="mt-1 text-xs text-zinc-500">#{e.id} · {e.created_at}</div>
                  </div>
                  <div className="text-xs text-zinc-600">{e.date || '(no date)'}</div>
                </div>
                <div className="mt-3 text-sm text-zinc-700">
                  sets: {e.sets ?? '-'} · reps: {e.reps ?? '-'} · weight: {e.weight ?? '-'}
                </div>
              </Card>
            ))}
            {data.entries.length === 0 ? (
              <Card>
                <p className="text-sm text-zinc-600">No entries yet. Add one above.</p>
              </Card>
            ) : null}
          </div>
        </div>

        <div className="text-sm text-zinc-600">
          <LinkA href="/api/apps/gym-tracker/health" target="_blank" rel="noreferrer">health</LinkA>
          {' · '}
          <LinkA href="/api/apps/gym-tracker/selftest" target="_blank" rel="noreferrer">selftest</LinkA>
        </div>
      </div>
    </Shell>
  );
}
