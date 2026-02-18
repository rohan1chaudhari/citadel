'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Input, Label, Textarea } from '@/components/Shell';

type MoodEntry = {
  id: number;
  date: string;
  mood: number;
  note: string | null;
  created_at: string;
  updated_at: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emojiForMood(mood: number) {
  if (mood <= 1) return '😞';
  if (mood === 2) return '😕';
  if (mood === 3) return '😐';
  if (mood === 4) return '🙂';
  return '😄';
}

export function SoumilMoodTrackerClient({ initialEntries }: { initialEntries: MoodEntry[] }) {
  const [entries, setEntries] = useState<MoodEntry[]>(initialEntries);
  const [date, setDate] = useState(today());
  const [mood, setMood] = useState(3);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avgMood = useMemo(() => {
    if (entries.length === 0) return null;
    const n = entries.reduce((sum, e) => sum + e.mood, 0) / entries.length;
    return n;
  }, [entries]);

  async function addEntry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/apps/soumil-mood-tracker/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date, mood, note })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      const now = new Date().toISOString();
      const newEntry: MoodEntry = {
        id: data.id,
        date,
        mood,
        note: note.trim() || null,
        created_at: now,
        updated_at: now
      };

      setEntries((prev) => [newEntry, ...prev]);
      setNote('');
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/soumil-mood-tracker/entries/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-sm font-semibold text-zinc-900">Log mood</h2>
        <div className="mt-3 grid gap-3 md:max-w-lg">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <Label>Mood ({mood}/5 {emojiForMood(mood)})</Label>
            <input
              className="mt-2 w-full"
              type="range"
              min={1}
              max={5}
              step={1}
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-500">
              <span>1 - rough</span>
              <span>5 - great</span>
            </div>
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What affected your mood today?" />
          </div>

          <div>
            <Button type="button" onClick={addEntry} disabled={busy}>{busy ? 'Saving…' : 'Save mood'}</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Recent entries</h2>
          <div className="text-xs text-zinc-500">
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
            {avgMood != null ? ` · avg ${avgMood.toFixed(1)}/5` : ''}
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No entries yet. Log your first mood above.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{e.date} · {e.mood}/5 {emojiForMood(e.mood)}</div>
                    {e.note ? <p className="mt-1 text-sm text-zinc-700 whitespace-pre-wrap">{e.note}</p> : null}
                  </div>
                  <Button type="button" variant="danger" onClick={() => removeEntry(e.id)} disabled={busy}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
