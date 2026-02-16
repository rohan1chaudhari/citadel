'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Input, Label } from '@/components/Shell';

const DAY_CATEGORIES = ['push', 'cardio', 'pull', 'leg'] as const;
type DayCategory = (typeof DAY_CATEGORIES)[number];

type Entry = {
  id: number;
  date: string | null;
  category: string | null;
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

type FormState = {
  date: string;
  category: DayCategory;
  exercise: string;
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
  rest_seconds: string;
  notes: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(category: DayCategory = 'push'): FormState {
  return { date: today(), category, exercise: '', sets: '', reps: '', weight: '', rpe: '', rest_seconds: '', notes: '' };
}

function normalizeCategory(v: string | null | undefined): DayCategory | null {
  const c = String(v ?? '').toLowerCase();
  return (DAY_CATEGORIES as readonly string[]).includes(c) ? (c as DayCategory) : null;
}

function nextCategory(prev: string | null | undefined): DayCategory {
  const current = normalizeCategory(prev);
  if (!current) return DAY_CATEGORIES[0];
  const idx = DAY_CATEGORIES.indexOf(current);
  return DAY_CATEGORIES[(idx + 1) % DAY_CATEGORIES.length];
}

function titleCase(s: string | null | undefined) {
  if (!s) return '-';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function asInput(v: number | null | undefined) {
  return v == null ? '' : String(v);
}

function displayDate(v: string | null) {
  return v || '-';
}

async function createEntry(payload: FormState) {
  const res = await fetch('/api/apps/gym-tracker/entries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as { ok: true; id: number };
}

async function patchEntry(id: number, payload: FormState) {
  const res = await fetch(`/api/apps/gym-tracker/entries/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
}

async function deleteEntry(id: number) {
  const res = await fetch(`/api/apps/gym-tracker/entries/${id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
}

export function GymTrackerClient({ initialEntries, recentExercises }: { initialEntries: Entry[]; recentExercises: string[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const suggestedCategory = nextCategory(initialEntries[0]?.category);
  const [form, setForm] = useState<FormState>(emptyForm(suggestedCategory));
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<FormState>(emptyForm(suggestedCategory));
  const [error, setError] = useState<string | null>(null);

  const lastEntry = entries[0] ?? null;

  const exerciseOptions = useMemo(() => {
    const m = new Map<string, true>();
    for (const e of recentExercises) m.set(e, true);
    for (const e of entries) if (e.exercise) m.set(e.exercise, true);
    return Array.from(m.keys()).slice(0, 30);
  }, [recentExercises, entries]);

  const fillFrom = (e: Entry) => {
    setForm({
      date: today(),
      category: normalizeCategory(e.category) ?? form.category,
      exercise: e.exercise,
      sets: asInput(e.sets),
      reps: asInput(e.reps),
      weight: asInput(e.weight),
      rpe: asInput(e.rpe),
      rest_seconds: asInput(e.rest_seconds),
      notes: e.notes ?? ''
    });
  };

  const fillFromExercise = () => {
    if (!form.exercise.trim()) return;
    const prev = entries.find((e) => e.exercise.toLowerCase() === form.exercise.trim().toLowerCase());
    if (prev) fillFrom(prev);
  };

  const submitNew = async () => {
    setError(null);
    if (!form.exercise.trim()) {
      setError('Exercise is required');
      return;
    }

    setBusy(true);
    try {
      const created = await createEntry(form);
      const now = new Date().toISOString();
      const newEntry: Entry = {
        id: created.id,
        date: form.date || null,
        category: form.category,
        exercise: form.exercise.trim(),
        sets: form.sets ? Number(form.sets) : null,
        reps: form.reps ? Number(form.reps) : null,
        weight: form.weight ? Number(form.weight) : null,
        rpe: form.rpe ? Number(form.rpe) : null,
        rest_seconds: form.rest_seconds ? Number(form.rest_seconds) : null,
        notes: form.notes.trim() || null,
        created_at: now,
        updated_at: now
      };

      setEntries((prev) => [newEntry, ...prev]);
      setForm((prev) => ({
        ...prev,
        category: nextCategory(prev.category),
        exercise: '',
        sets: '',
        reps: '',
        weight: '',
        rpe: '',
        rest_seconds: '',
        notes: ''
      }));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (e: Entry) => {
    setEditingId(e.id);
    setEditing({
      date: e.date || today(),
      category: normalizeCategory(e.category) ?? 'push',
      exercise: e.exercise,
      sets: asInput(e.sets),
      reps: asInput(e.reps),
      weight: asInput(e.weight),
      rpe: asInput(e.rpe),
      rest_seconds: asInput(e.rest_seconds),
      notes: e.notes ?? ''
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await patchEntry(editingId, editing);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? {
                ...e,
                date: editing.date || null,
                category: editing.category,
                exercise: editing.exercise.trim(),
                sets: editing.sets ? Number(editing.sets) : null,
                reps: editing.reps ? Number(editing.reps) : null,
                weight: editing.weight ? Number(editing.weight) : null,
                rpe: editing.rpe ? Number(editing.rpe) : null,
                rest_seconds: editing.rest_seconds ? Number(editing.rest_seconds) : null,
                notes: editing.notes.trim() || null,
                updated_at: new Date().toISOString()
              }
            : e
        )
      );
      setEditingId(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Quick log</h2>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => lastEntry && fillFrom(lastEntry)} disabled={!lastEntry || busy}>
              Duplicate last
            </Button>
            <Button type="button" variant="secondary" onClick={fillFromExercise} disabled={busy || !form.exercise.trim()}>
              Use last for exercise
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Category (suggested order)</Label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as DayCategory }))}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
              >
                {DAY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{titleCase(c)}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Exercise</Label>
              <Input
                list="exercise-suggestions"
                value={form.exercise}
                placeholder="Bench press"
                onChange={(e) => setForm((p) => ({ ...p, exercise: e.target.value }))}
              />
              <datalist id="exercise-suggestions">
                {exerciseOptions.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            <div>
              <Label>Sets</Label>
              <Input inputMode="numeric" type="number" min="0" step="1" value={form.sets} onChange={(e) => setForm((p) => ({ ...p, sets: e.target.value }))} />
            </div>
            <div>
              <Label>Reps</Label>
              <Input inputMode="numeric" type="number" min="0" step="1" value={form.reps} onChange={(e) => setForm((p) => ({ ...p, reps: e.target.value }))} />
            </div>
            <div>
              <Label>Weight</Label>
              <Input inputMode="decimal" type="number" min="0" step="0.5" value={form.weight} onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))} />
            </div>
            <div>
              <Label>RPE</Label>
              <Input inputMode="decimal" type="number" min="0" max="10" step="0.5" value={form.rpe} onChange={(e) => setForm((p) => ({ ...p, rpe: e.target.value }))} />
            </div>
            <div>
              <Label>Rest (s)</Label>
              <Input inputMode="numeric" type="number" min="0" step="5" value={form.rest_seconds} onChange={(e) => setForm((p) => ({ ...p, rest_seconds: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={submitNew} disabled={busy} className="w-full">{busy ? 'Saving…' : 'Add entry'}</Button>
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="mt-1 h-20 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
              placeholder="Tempo, cues, pain notes, etc."
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      </Card>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Recent</h2>
          <div className="text-xs text-zinc-500">{entries.length} entries</div>
        </div>

        <div className="mt-3 grid gap-3">
          {entries.map((e) => {
            const isEditing = editingId === e.id;
            return (
              <Card key={e.id}>
                {!isEditing ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-zinc-900">{e.exercise}</div>
                          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700">{titleCase(e.category)}</span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">#{e.id} · {displayDate(e.date)} · {e.created_at}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={() => startEdit(e)} disabled={busy}>Edit</Button>
                        <Button type="button" variant="danger" onClick={() => remove(e.id)} disabled={busy}>Delete</Button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-zinc-700">
                      sets: {asInput(e.sets) || '-'} · reps: {asInput(e.reps) || '-'} · weight: {asInput(e.weight) || '-'} · rpe: {asInput(e.rpe) || '-'} · rest: {asInput(e.rest_seconds) || '-'}s
                    </div>
                    {e.notes ? <div className="mt-2 text-sm text-zinc-600">{e.notes}</div> : null}
                  </>
                ) : (
                  <div className="grid gap-2">
                    <Input type="date" value={editing.date} onChange={(ev) => setEditing((p) => ({ ...p, date: ev.target.value }))} />
                    <select
                      value={editing.category}
                      onChange={(ev) => setEditing((p) => ({ ...p, category: ev.target.value as DayCategory }))}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
                    >
                      {DAY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{titleCase(c)}</option>
                      ))}
                    </select>
                    <Input value={editing.exercise} onChange={(ev) => setEditing((p) => ({ ...p, exercise: ev.target.value }))} placeholder="Exercise" />
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                      <Input inputMode="numeric" type="number" value={editing.sets} onChange={(ev) => setEditing((p) => ({ ...p, sets: ev.target.value }))} placeholder="Sets" />
                      <Input inputMode="numeric" type="number" value={editing.reps} onChange={(ev) => setEditing((p) => ({ ...p, reps: ev.target.value }))} placeholder="Reps" />
                      <Input inputMode="decimal" type="number" value={editing.weight} onChange={(ev) => setEditing((p) => ({ ...p, weight: ev.target.value }))} placeholder="Weight" />
                      <Input inputMode="decimal" type="number" value={editing.rpe} onChange={(ev) => setEditing((p) => ({ ...p, rpe: ev.target.value }))} placeholder="RPE" />
                      <Input inputMode="numeric" type="number" value={editing.rest_seconds} onChange={(ev) => setEditing((p) => ({ ...p, rest_seconds: ev.target.value }))} placeholder="Rest (s)" />
                    </div>
                    <textarea
                      value={editing.notes}
                      onChange={(ev) => setEditing((p) => ({ ...p, notes: ev.target.value }))}
                      className="h-16 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
                      placeholder="Notes"
                    />
                    <div className="flex gap-2">
                      <Button type="button" onClick={saveEdit} disabled={busy}>Save</Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={busy}>Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {entries.length === 0 ? (
            <Card>
              <p className="text-sm text-zinc-600">No entries yet. Add one above.</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
