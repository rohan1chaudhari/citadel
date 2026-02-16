'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Label } from '@/components/Shell';

const DAY_CATEGORIES = ['push', 'cardio', 'pull', 'leg'] as const;
type DayCategory = (typeof DAY_CATEGORIES)[number];

type Entry = {
  id: number;
  date: string | null;
  category: string | null;
  exercise: string;
  sets: number | null; // set number
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type ActiveSession = {
  id: string;
  category: DayCategory;
  startedAt: string;
  exercise: string;
  nextSet: number;
};

const SESSION_KEY = 'gym-tracker-active-session-v1';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function titleCase(s: string | null | undefined) {
  if (!s) return '-';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeCategory(v: string | null | undefined): DayCategory | null {
  const c = String(v ?? '').toLowerCase().trim();
  return (DAY_CATEGORIES as readonly string[]).includes(c) ? (c as DayCategory) : null;
}

function nextCategory(prev: string | null | undefined): DayCategory {
  const current = normalizeCategory(prev);
  if (!current) return DAY_CATEGORIES[0];
  const idx = DAY_CATEGORIES.indexOf(current);
  return DAY_CATEGORIES[(idx + 1) % DAY_CATEGORIES.length];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function createEntry(payload: {
  date: string;
  category: DayCategory;
  exercise: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  session_id: string;
}) {
  const res = await fetch('/api/apps/gym-tracker/entries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as { ok: true; id: number };
}

export function GymTrackerClient({ initialEntries }: { initialEntries: Entry[]; recentExercises: string[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedCategory = useMemo(() => nextCategory(initialEntries[0]?.category), [initialEntries]);
  const [startCategory, setStartCategory] = useState<DayCategory>(suggestedCategory);
  const [session, setSession] = useState<ActiveSession | null>(null);

  const [exerciseName, setExerciseName] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ActiveSession;
      if (parsed?.id && parsed?.category && parsed?.startedAt) setSession(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [session]);

  const sessionEntries = useMemo(() => {
    if (!session?.id) return [] as Entry[];
    return entries.filter((e) => e.session_id === session.id);
  }, [entries, session]);

  const startSession = () => {
    setError(null);
    const id = `sess_${Date.now()}`;
    const startedAt = new Date().toISOString();
    setSession({ id, category: startCategory, startedAt, exercise: '', nextSet: 1 });
    setExerciseName('');
    setWeight('');
    setReps('');
  };

  const endSession = () => {
    setSession(null);
    setStartCategory(nextCategory(entries[0]?.category));
    setExerciseName('');
    setWeight('');
    setReps('');
  };

  const startExercise = () => {
    if (!session) return;
    const name = exerciseName.trim();
    if (!name) {
      setError('Exercise name is required');
      return;
    }

    const maxSet = sessionEntries
      .filter((e) => e.exercise.toLowerCase() === name.toLowerCase())
      .reduce((m, e) => Math.max(m, e.sets ?? 0), 0);

    setSession({ ...session, exercise: name, nextSet: maxSet + 1 });
    setError(null);
  };

  const logSet = async () => {
    if (!session || !session.exercise) return;
    setBusy(true);
    setError(null);
    try {
      const nWeight = weight.trim() ? Number(weight) : null;
      const nReps = reps.trim() ? Number(reps) : null;
      const created = await createEntry({
        date: today(),
        category: session.category,
        exercise: session.exercise,
        sets: session.nextSet,
        reps: Number.isFinite(nReps as number) ? nReps : null,
        weight: Number.isFinite(nWeight as number) ? nWeight : null,
        session_id: session.id
      });

      const now = new Date().toISOString();
      const newEntry: Entry = {
        id: created.id,
        date: today(),
        category: session.category,
        exercise: session.exercise,
        sets: session.nextSet,
        reps: Number.isFinite(nReps as number) ? nReps : null,
        weight: Number.isFinite(nWeight as number) ? nWeight : null,
        rpe: null,
        rest_seconds: null,
        notes: null,
        session_id: session.id,
        created_at: now,
        updated_at: now
      };

      setEntries((prev) => [newEntry, ...prev]);
      setSession((prev) => (prev ? { ...prev, nextSet: prev.nextSet + 1 } : prev));
      setReps('');
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const startNextExercise = () => {
    if (!session) return;
    setSession({ ...session, exercise: '', nextSet: 1 });
    setExerciseName('');
    setWeight('');
    setReps('');
  };

  return (
    <div className="grid gap-6">
      {!session ? (
        <Card>
          <h2 className="text-sm font-semibold text-zinc-900">Start session</h2>
          <p className="mt-1 text-sm text-zinc-600">Choose category first (suggested order: Push → Cardio → Pull → Leg).</p>
          <div className="mt-3 grid gap-3 md:max-w-xs">
            <div>
              <Label>Category</Label>
              <select
                value={startCategory}
                onChange={(e) => setStartCategory(e.target.value as DayCategory)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
              >
                {DAY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{titleCase(c)}</option>
                ))}
              </select>
            </div>
            <Button type="button" onClick={startSession}>Start session</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Session live</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {titleCase(session.category)} · started {formatTime(session.startedAt)}
                {session.exercise ? ` · ${session.exercise} (Set ${session.nextSet})` : ''}
              </p>
            </div>
            <Button type="button" variant="danger" onClick={endSession}>End session</Button>
          </div>

          {!session.exercise ? (
            <div className="mt-4 grid gap-3 md:max-w-md">
              <div>
                <Label>Exercise name</Label>
                <Input
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  placeholder="Bench press"
                />
              </div>
              <Button type="button" onClick={startExercise}>Start exercise</Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-2 md:max-w-md">
                <div>
                  <Label>Weight</Label>
                  <Input inputMode="decimal" type="number" min="0" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" />
                </div>
                <div>
                  <Label>Reps</Label>
                  <Input inputMode="numeric" type="number" min="0" step="1" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="8" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" onClick={logSet} disabled={busy}>{busy ? 'Saving…' : `Log set ${session.nextSet}`}</Button>
                <Button type="button" variant="secondary" onClick={startNextExercise} disabled={busy}>Start next exercise</Button>
              </div>

              {sessionEntries.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  <div className="text-xs font-medium text-zinc-500">This session</div>
                  {sessionEntries
                    .filter((e) => e.exercise === session.exercise)
                    .sort((a, b) => (a.sets ?? 0) - (b.sets ?? 0))
                    .map((e) => (
                      <div key={e.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                        Set {e.sets ?? '-'} · {e.weight ?? '-'} kg · {e.reps ?? '-'} reps · {formatTime(e.created_at)}
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          )}
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Recent logs</h2>
          <div className="text-xs text-zinc-500">{entries.length} sets</div>
        </div>

        <div className="mt-3 grid gap-2">
          {entries.slice(0, 40).map((e) => (
            <Card key={e.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-zinc-900">{e.exercise}</div>
                <div className="text-xs text-zinc-500">{titleCase(e.category)} · {formatTime(e.created_at)}</div>
              </div>
              <div className="mt-1 text-sm text-zinc-700">Set {e.sets ?? '-'} · {e.weight ?? '-'} kg · {e.reps ?? '-'} reps</div>
            </Card>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
