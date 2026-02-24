'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input, Label } from '@/components/Shell';

const DAY_CATEGORIES = ['push', 'cardio', 'pull', 'leg'] as const;
type DayCategory = (typeof DAY_CATEGORIES)[number];

interface Entry {
  id: number;
  date: string | null;
  category: string | null;
  exercise: string;
  exercise_id: number | null;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Exercise {
  id: number;
  name: string;
  category: string | null;
  usage_count?: number;
}

type ActiveSession = {
  id: string;
  category: DayCategory;
  startedAt: string;
  exercise: string;
  nextSet: number;
};

type SessionGroup = {
  id: string;
  label: string;
  category: string | null;
  startedAt: string;
  entries: Entry[];
};

type SessionDraft = {
  id: string;
  endedAt: string;
  reason: 'ended' | 'interrupted';
  session: ActiveSession;
  exerciseName: string;
  weight: string;
  reps: string;
};

type PersistedSessionState = {
  session: ActiveSession;
  exerciseName: string;
  weight: string;
  reps: string;
};

const SESSION_KEY = 'gym-tracker-active-session-v2';
const LEGACY_SESSION_KEY = 'gym-tracker-active-session-v1';
const SESSION_DRAFTS_KEY = 'gym-tracker-session-drafts-v1';
const MAX_DRAFTS = 5;

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

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function rangeDays(r: '3d' | '7d' | '30d' | '90d') {
  if (r === '3d') return 3;
  if (r === '7d') return 7;
  if (r === '30d') return 30;
  return 90;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function entryDay(e: Entry) {
  return e.date || dayKey(e.created_at);
}

function weekStartKey(day: string) {
  const d = new Date(`${day}T00:00:00`);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function sameExercise(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
  return data as { ok: true; id: number; isNewExercise?: boolean; exercise?: string };
}

async function patchEntry(id: number, payload: Partial<Entry>) {
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

export function GymTrackerClient({ 
  initialEntries, 
  recentExercises,
  initialExercises = []
}: { 
  initialEntries: Entry[]; 
  recentExercises: string[];
  initialExercises?: Exercise[];
}) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [tab, setTab] = useState<'log' | 'history' | 'analytics'>('log');
  const SESSIONS_PER_PAGE = 10;

  const suggestedCategory = useMemo(() => nextCategory(initialEntries[0]?.category), [initialEntries]);
  const [startCategory, setStartCategory] = useState<DayCategory>(suggestedCategory);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [sessionDrafts, setSessionDrafts] = useState<SessionDraft[]>([]);

  const [exerciseName, setExerciseName] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingWeight, setEditingWeight] = useState('');
  const [editingReps, setEditingReps] = useState('');

  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing' | 'error'>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Autocomplete refs/state
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [range, setRange] = useState<'3d' | '7d' | '30d' | '90d'>('30d');
  const [analyticsMode, setAnalyticsMode] = useState<'overview' | 'consistency' | 'exercise-load'>('overview');
  const [analyticsCategory, setAnalyticsCategory] = useState<'all' | DayCategory>('all');
  const [analyticsExercise, setAnalyticsExercise] = useState<string>('all');

  // Fetch exercises on mount
  useEffect(() => {
    fetch('/api/apps/gym-tracker/exercises')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.exercises) {
          setExercises(data.exercises);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSessionState;
        if (parsed?.session?.id && parsed?.session?.category && parsed?.session?.startedAt) {
          setSession(parsed.session);
          setExerciseName(parsed.exerciseName || '');
          setWeight(parsed.weight || '');
          setReps(parsed.reps || '');
        }
      } else {
        const legacyRaw = localStorage.getItem(LEGACY_SESSION_KEY);
        if (legacyRaw) {
          const parsedLegacy = JSON.parse(legacyRaw) as ActiveSession;
          if (parsedLegacy?.id && parsedLegacy?.category && parsedLegacy?.startedAt) setSession(parsedLegacy);
          localStorage.removeItem(LEGACY_SESSION_KEY);
        }
      }
    } catch {}

    try {
      const rawDrafts = localStorage.getItem(SESSION_DRAFTS_KEY);
      if (!rawDrafts) return;
      const parsedDrafts = JSON.parse(rawDrafts) as SessionDraft[];
      if (Array.isArray(parsedDrafts)) setSessionDrafts(parsedDrafts.slice(0, MAX_DRAFTS));
    } catch {}
  }, []);

  useEffect(() => {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const payload: PersistedSessionState = { session, exerciseName, weight, reps };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }, [session, exerciseName, weight, reps]);

  useEffect(() => {
    try {
      if (!sessionDrafts.length) {
        localStorage.removeItem(SESSION_DRAFTS_KEY);
        return;
      }
      localStorage.setItem(SESSION_DRAFTS_KEY, JSON.stringify(sessionDrafts.slice(0, MAX_DRAFTS)));
    } catch {}
  }, [sessionDrafts]);

  const sessionEntries = useMemo(() => {
    if (!session?.id) return [] as Entry[];
    return entries.filter((e) => e.session_id === session.id);
  }, [entries, session]);

  // Autocomplete filtered exercises
  const filteredExercises = useMemo(() => {
    if (!exerciseName.trim()) {
      // Show popular exercises when empty
      return exercises.slice(0, 8);
    }
    const query = exerciseName.toLowerCase();
    return exercises
      .filter(ex => ex.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [exerciseName, exercises]);

  const exerciseOptions = useMemo(() => {
    const m = new Map<string, true>();
    for (const e of recentExercises) m.set(e, true);
    for (const e of entries) if (e.exercise?.trim()) m.set(e.exercise.trim(), true);
    for (const e of exercises) m.set(e.name, true);
    return Array.from(m.keys()).slice(0, 100);
  }, [recentExercises, entries, exercises]);

  const suggestedFromHistory = useMemo(() => {
    if (!exerciseName.trim()) return null;
    const needle = exerciseName.trim().toLowerCase();
    const prev = entries.find((e) => e.exercise.toLowerCase() === needle && e.session_id !== session?.id);
    if (!prev) return null;
    return { weight: prev.weight, reps: prev.reps, when: prev.created_at };
  }, [exerciseName, entries, session?.id]);

  const groupedSessions = useMemo<SessionGroup[]>(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = e.session_id || `single-${e.date || e.created_at.slice(0, 10)}-${e.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }

    const groups = Array.from(map.entries()).map(([id, list]) => {
      const sorted = [...list].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      const first = sorted[0];
      const sessionDate = first.date || first.created_at.slice(0, 10);
      return {
        id,
        label: `${titleCase(first.category)} ${sessionDate}`,
        category: first.category,
        startedAt: first.created_at,
        entries: sorted
      };
    });

    return groups.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  }, [entries]);

  const totalHistoryPages = Math.max(1, Math.ceil(groupedSessions.length / SESSIONS_PER_PAGE));
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const pagedSessions = groupedSessions.slice((currentHistoryPage - 1) * SESSIONS_PER_PAGE, currentHistoryPage * SESSIONS_PER_PAGE);

  const rangeStartMs = Date.now() - rangeDays(range) * 24 * 60 * 60 * 1000;
  const analyticsEntries = entries.filter((e) => {
    const t = Date.parse(`${entryDay(e)}T00:00:00`);
    if (!Number.isFinite(t) || t < rangeStartMs) return false;
    if (analyticsCategory !== 'all' && e.category !== analyticsCategory) return false;
    if (analyticsExercise !== 'all' && e.exercise !== analyticsExercise) return false;
    return true;
  });

  const analyticsSessions = (() => {
    const map = new Map<string, Entry[]>();
    for (const e of analyticsEntries) {
      const key = e.session_id || `single-${e.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.values());
  })();

  const totalVolume = analyticsEntries.reduce((sum, e) => sum + (e.weight ?? 0) * (e.reps ?? 0), 0);
  const avgReps = analyticsEntries.length ? analyticsEntries.reduce((s, e) => s + (e.reps ?? 0), 0) / analyticsEntries.length : 0;
  const heaviest = analyticsEntries.reduce((m, e) => Math.max(m, e.weight ?? 0), 0);

  const weeklyCategory = (() => {
    const m = new Map<string, Record<DayCategory, number>>();
    for (const e of analyticsEntries) {
      const wk = weekStartKey(entryDay(e));
      if (!m.has(wk)) m.set(wk, { push: 0, cardio: 0, pull: 0, leg: 0 });
      const cat = normalizeCategory(e.category) ?? 'push';
      m.get(wk)![cat] += 1;
    }
    return Array.from(m.entries())
      .map(([week, counts]) => ({ week, counts, total: DAY_CATEGORIES.reduce((s, c) => s + counts[c], 0) }))
      .sort((a, b) => a.week.localeCompare(b.week));
  })();

  const heatmapDays = (() => {
    const countByDay = new Map<string, number>();
    for (const e of analyticsEntries) {
      const d = entryDay(e);
      countByDay.set(d, (countByDay.get(d) ?? 0) + 1);
    }
    const out: { day: string; count: number }[] = [];
    for (let i = rangeDays(range) - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, count: countByDay.get(key) ?? 0 });
    }
    return out;
  })();

  const exerciseLoadProgression = (() => {
    const byExercise = new Map<string, Map<string, number>>();
    for (const e of analyticsEntries) {
      const ex = e.exercise;
      const d = entryDay(e);
      if (!byExercise.has(ex)) byExercise.set(ex, new Map<string, number>());
      const exMap = byExercise.get(ex)!;
      exMap.set(d, (exMap.get(d) ?? 0) + (e.weight ?? 0) * (e.reps ?? 0));
    }

    const rows = Array.from(byExercise.entries()).map(([exercise, dayMap]) => {
      const points = Array.from(dayMap.entries())
        .map(([date, load]) => ({ date, load }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const first = points[0]?.load ?? 0;
      const last = points[points.length - 1]?.load ?? 0;
      const delta = last - first;
      return { exercise, points, first, last, delta };
    });

    rows.sort((a, b) => b.last - a.last);
    return rows;
  })();

  const lineRows = analyticsExercise === 'all' ? exerciseLoadProgression.slice(0, 4) : exerciseLoadProgression;

  const daysInRange = rangeDays(range);
  const sessionsPerWeek = analyticsSessions.length / Math.max(1, daysInRange / 7);
  const activeDaysPerWeek = Array.from(new Set(analyticsEntries.map((e) => entryDay(e)))).length / Math.max(1, daysInRange / 7);
  const activeDays = Array.from(new Set(analyticsEntries.map((e) => entryDay(e)))).sort();

  const archiveSessionDraft = (reason: 'ended' | 'interrupted') => {
    if (!session) return;
    const draft: SessionDraft = {
      id: `draft_${Date.now()}_${session.id}`,
      endedAt: new Date().toISOString(),
      reason,
      session,
      exerciseName,
      weight,
      reps
    };

    setSessionDrafts((prev) => [draft, ...prev.filter((d) => d.session.id !== session.id)].slice(0, MAX_DRAFTS));
  };

  const startSession = () => {
    setError(null);
    const id = `sess_${Date.now()}`;
    const startedAt = new Date().toISOString();
    setSession({ id, category: startCategory, startedAt, exercise: '', nextSet: 1 });
    setExerciseName('');
    setWeight('');
    setReps('');
  };

  const resumeLastSession = () => {
    const lastGroup = groupedSessions[0];
    if (!lastGroup || !lastGroup.entries.length) {
      setError('No previous session found to resume');
      return;
    }

    const sorted = [...lastGroup.entries].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const lastEntry = sorted[sorted.length - 1];
    const category = normalizeCategory(lastGroup.category) ?? startCategory;
    const exercise = lastEntry.exercise;
    const maxSetForExercise = sorted
      .filter((e) => sameExercise(e.exercise, exercise))
      .reduce((m, e) => Math.max(m, e.sets ?? 0), 0);

    const sessionId = lastGroup.id.startsWith('single-') ? `sess_${Date.now()}` : lastGroup.id;

    setSession({
      id: sessionId,
      category,
      startedAt: sorted[0]?.created_at || new Date().toISOString(),
      exercise,
      nextSet: maxSetForExercise + 1
    });
    setExerciseName(exercise);
    setWeight(lastEntry.weight == null ? '' : String(lastEntry.weight));
    setReps(lastEntry.reps == null ? '' : String(lastEntry.reps));
    setError(null);
    setToast({ message: `Resumed ${titleCase(category)} session`, type: 'success' });
    setTimeout(() => setToast(null), 2500);
  };

  const resumeDraft = (draft: SessionDraft) => {
    setSession(draft.session);
    setExerciseName(draft.exerciseName || draft.session.exercise || '');
    setWeight(draft.weight || '');
    setReps(draft.reps || '');
    setSessionDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    setError(null);
    setToast({ message: 'Session resumed', type: 'success' });
    setTimeout(() => setToast(null), 2500);
  };

  const discardDraft = (draftId: string) => {
    setSessionDrafts((prev) => prev.filter((d) => d.id !== draftId));
  };

  const endSession = () => {
    archiveSessionDraft('ended');
    setSession(null);
    setStartCategory(nextCategory(entries[0]?.category));
    setExerciseName('');
    setWeight('');
    setReps('');
  };

  const handleExerciseSelect = (selected: Exercise) => {
    setExerciseName(selected.name);
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => i < filteredExercises.length - 1 ? i + 1 : i);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => (i > 0 ? i - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredExercises[highlightedIndex]) {
        handleExerciseSelect(filteredExercises[highlightedIndex]);
      } else {
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Handle clicks outside dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

    const suggested = entries.find((e) => e.exercise.toLowerCase() === name.toLowerCase() && e.session_id !== session.id);
    setSession({ ...session, exercise: name, nextSet: maxSet + 1 });
    if (suggested?.weight != null) setWeight(String(suggested.weight));
    if (suggested?.reps != null) setReps(String(suggested.reps));
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

      // Show toast for new exercise
      if (created.isNewExercise) {
        setToast({ message: `New exercise added: ${created.exercise}`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
      }

      const now = new Date().toISOString();
      const newEntry: Entry = {
        id: created.id,
        date: today(),
        category: session.category,
        exercise: session.exercise,
        exercise_id: null,
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

  const beginEdit = (e: Entry) => {
    setEditingId(e.id);
    setEditingWeight(e.weight == null ? '' : String(e.weight));
    setEditingReps(e.reps == null ? '' : String(e.reps));
  };

  const saveEdit = async (e: Entry) => {
    setBusy(true);
    setError(null);
    try {
      const newWeight = editingWeight.trim() ? Number(editingWeight) : null;
      const newReps = editingReps.trim() ? Number(editingReps) : null;
      await patchEntry(e.id, {
        date: e.date,
        category: e.category,
        exercise: e.exercise,
        sets: e.sets,
        weight: Number.isFinite(newWeight as number) ? newWeight : null,
        reps: Number.isFinite(newReps as number) ? newReps : null,
        session_id: e.session_id
      });

      setEntries((prev) =>
        prev.map((x) =>
          x.id === e.id
            ? {
                ...x,
                weight: Number.isFinite(newWeight as number) ? newWeight : null,
                reps: Number.isFinite(newReps as number) ? newReps : null,
                updated_at: new Date().toISOString()
              }
            : x
        )
      );
      setEditingId(null);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const removeSet = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const startVoiceFill = async () => {
    try {
      setVoiceTranscript('');
      setVoiceState('recording');
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
    } catch {
      setVoiceState('error');
    }
  };

  const stopVoiceFill = async () => {
    const rec = mediaRef.current;
    if (!rec) return;
    setVoiceState('processing');

    await new Promise<void>((resolve) => {
      rec.addEventListener('stop', () => resolve(), { once: true });
      if (rec.state === 'recording') rec.stop();
      else resolve();
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], 'set.webm', { type: 'audio/webm' });
      const fd = new FormData();
      fd.set('audio', file);
      fd.set('context', JSON.stringify({
        category: session?.category ?? null,
        exercise: session?.exercise || exerciseName || null,
        nextSet: session?.nextSet ?? 1,
        lastWeight: weight || null,
        lastReps: reps || null
      }));

      const res = await fetch('/api/apps/gym-tracker/voice-parse', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      const transcript = String(data?.transcript ?? '');
      const extracted = data?.extracted ?? {};

      setVoiceTranscript(transcript);

      const parsedExercise = typeof extracted?.exercise === 'string' && extracted.exercise.trim() ? extracted.exercise.trim() : null;
      const parsedSet = Number.isFinite(Number(extracted?.set)) ? Number(extracted.set) : null;
      const parsedWeight = Number.isFinite(Number(extracted?.weight)) ? Number(extracted.weight) : null;
      const parsedReps = Number.isFinite(Number(extracted?.reps)) ? Number(extracted.reps) : null;

      if (parsedWeight != null) setWeight(String(parsedWeight));
      if (parsedReps != null) setReps(String(parsedReps));

      if (session) {
        const ex = parsedExercise ?? session.exercise ?? (exerciseName.trim() || '');
        if (ex) {
          const maxSetForExercise = sessionEntries
            .filter((e) => e.exercise.toLowerCase() === ex.toLowerCase())
            .reduce((m, e) => Math.max(m, e.sets ?? 0), 0);

          const nextSet = parsedSet && parsedSet > 0 ? parsedSet : maxSetForExercise + 1;
          setSession((prev) => (prev ? { ...prev, exercise: ex, nextSet } : prev));
          setExerciseName(ex);
        }
      }

      setVoiceState('idle');
      mediaRef.current = null;
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setVoiceState('error');
      mediaRef.current = null;
    }
  };

  useEffect(() => {
    if (historyPage > totalHistoryPages) setHistoryPage(totalHistoryPages);
  }, [historyPage, totalHistoryPages]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!session) return;
      const draft: SessionDraft = {
        id: `draft_${Date.now()}_${session.id}`,
        endedAt: new Date().toISOString(),
        reason: 'interrupted',
        session,
        exerciseName,
        weight,
        reps
      };
      try {
        const raw = localStorage.getItem(SESSION_DRAFTS_KEY);
        const prev = raw ? (JSON.parse(raw) as SessionDraft[]) : [];
        const next = [draft, ...prev.filter((d) => d.session.id !== session.id)].slice(0, MAX_DRAFTS);
        localStorage.setItem(SESSION_DRAFTS_KEY, JSON.stringify(next));
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      try {
        if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [session, exerciseName, weight, reps]);

  return (
    <div className="grid gap-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-white shadow-lg animate-in fade-in slide-in-from-top-2"
          style={{ background: toast.type === 'success' ? '#22c55e' : '#3b82f6' }}>
          {toast.message}
        </div>
      )}

      <div className="sticky top-0 z-30 -mx-3 border-b border-zinc-200 bg-zinc-50/95 px-3 py-2 backdrop-blur md:mx-0 md:rounded-xl md:border md:bg-white/95">
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant={tab === 'log' ? 'primary' : 'secondary'} onClick={() => setTab('log')} className="w-full">Log</Button>
          <Button type="button" variant={tab === 'history' ? 'primary' : 'secondary'} onClick={() => setTab('history')} className="w-full">History</Button>
          <Button type="button" variant={tab === 'analytics' ? 'primary' : 'secondary'} onClick={() => setTab('analytics')} className="w-full">Analytics</Button>
        </div>
      </div>

      {tab === 'log' ? !session ? (
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
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={resumeLastSession} disabled={groupedSessions.length === 0}>Resume last session</Button>
              <Button type="button" variant="secondary" onClick={startSession}>Start session</Button>
            </div>
          </div>

          {sessionDrafts.length > 0 ? (
            <div className="mt-4 grid gap-2">
              <div className="text-xs font-medium text-zinc-500">Recover a recent session</div>
              {sessionDrafts.map((draft) => (
                <div key={draft.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <div className="text-zinc-700">
                    {titleCase(draft.session.category)} · started {formatDateTime(draft.session.startedAt)}
                    {draft.exerciseName ? ` · ${draft.exerciseName}` : ''}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => resumeDraft(draft)}>Resume</Button>
                    <Button type="button" variant="danger" onClick={() => discardDraft(draft.id)}>Discard</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
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
              <div className="relative">
                <Label>Exercise name</Label>
                <input
                  ref={inputRef}
                  type="text"
                  value={exerciseName}
                  onChange={(e) => {
                    setExerciseName(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Type to search exercises..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
                />
                
                {/* Autocomplete Dropdown */}
                {showDropdown && (
                  <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg"
                  >
                    {filteredExercises.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-zinc-500">
                        {exerciseName.trim() 
                          ? `Press Enter to add "${exerciseName}" as new exercise` 
                          : 'Start typing to search exercises'}
                      </div>
                    ) : (
                      filteredExercises.map((ex, idx) => (
                        <div
                          key={ex.id}
                          onClick={() => handleExerciseSelect(ex)}
                          className={`cursor-pointer border-b border-zinc-100 px-3 py-2 last:border-0 hover:bg-zinc-50 ${
                            idx === highlightedIndex ? 'bg-zinc-100' : ''
                          }`}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                        >
                          <div className="font-medium text-zinc-900">{ex.name}</div>
                          {ex.category && (
                            <div className="text-xs capitalize text-zinc-500">{ex.category}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              {suggestedFromHistory ? (
                <p className="text-xs text-zinc-500">
                  Last time: {suggestedFromHistory.weight ?? '-'} kg × {suggestedFromHistory.reps ?? '-'} reps ({formatDateTime(suggestedFromHistory.when)})
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={startExercise}>Start exercise</Button>
                {voiceState === 'recording' ? (
                  <Button type="button" variant="danger" onClick={stopVoiceFill}>Stop voice</Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={startVoiceFill} disabled={voiceState === 'processing'}>
                    {voiceState === 'processing' ? 'Processing…' : 'Voice fill'}
                  </Button>
                )}
              </div>
              {voiceTranscript ? <div className="text-xs text-zinc-500">Heard: "{voiceTranscript}"</div> : null}
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

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={logSet} disabled={busy}>{busy ? 'Saving…' : `Create set ${session.nextSet}`}</Button>
                <Button type="button" variant="secondary" onClick={startNextExercise} disabled={busy}>Start next exercise</Button>
                {voiceState === 'recording' ? (
                  <Button type="button" variant="danger" onClick={stopVoiceFill}>Stop voice</Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={startVoiceFill} disabled={voiceState === 'processing'}>
                    {voiceState === 'processing' ? 'Processing…' : 'Voice fill'}
                  </Button>
                )}
              </div>
              {voiceTranscript ? <div className="text-xs text-zinc-500">Heard: "{voiceTranscript}"</div> : null}

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
      ) : null}

      {tab === 'history' ? (
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">History</h2>
          <div className="text-xs text-zinc-500">{entries.length} sets · page {currentHistoryPage}/{totalHistoryPages}</div>
        </div>

        {totalHistoryPages > 1 ? (
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={currentHistoryPage <= 1}>Prev</Button>
            <Button type="button" variant="secondary" onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))} disabled={currentHistoryPage >= totalHistoryPages}>Next</Button>
          </div>
        ) : null}

        <div className="mt-3 grid gap-2">
          {pagedSessions.map((group) => {
            const exerciseNames = Array.from(new Set(group.entries.map((e) => e.exercise)));
            return (
              <details key={group.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-900">{group.label}</div>
                    <div className="text-xs text-zinc-500">{titleCase(group.category)} · {exerciseNames.length} exercises · {group.entries.length} sets</div>
                  </div>
                </summary>

                <div className="mt-3 grid gap-2">
                  {exerciseNames.map((ex) => {
                    const setsForExercise = group.entries.filter((e) => e.exercise === ex).sort((a, b) => (a.sets ?? 0) - (b.sets ?? 0));
                    return (
                      <details key={`${group.id}-${ex}`} className="rounded-lg border border-zinc-200 p-2" open>
                        <summary className="cursor-pointer list-none text-sm font-medium text-zinc-800">{ex}</summary>
                        <div className="mt-2 grid gap-2">
                          {setsForExercise.map((e) => (
                            <div key={e.id} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                              {editingId === e.id ? (
                                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                                  <Input inputMode="decimal" type="number" value={editingWeight} onChange={(ev) => setEditingWeight(ev.target.value)} placeholder="Weight" />
                                  <Input inputMode="numeric" type="number" value={editingReps} onChange={(ev) => setEditingReps(ev.target.value)} placeholder="Reps" />
                                  <Button type="button" onClick={() => saveEdit(e)} disabled={busy}>Save</Button>
                                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={busy}>Cancel</Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm text-zinc-700">Set {e.sets ?? '-'} · {e.weight ?? '-'} kg · {e.reps ?? '-'} reps · {formatTime(e.created_at)}</div>
                                  <div className="flex gap-2">
                                    <Button type="button" variant="secondary" onClick={() => beginEdit(e)} disabled={busy}>Edit</Button>
                                    <Button type="button" variant="danger" onClick={() => removeSet(e.id)} disabled={busy}>Delete</Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>
      ) : null}

      {tab === 'analytics' ? (
        <div className="grid gap-4">
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full md:min-w-[260px] md:w-auto">
                <Label>Mode</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Button type="button" variant={analyticsMode === 'overview' ? 'primary' : 'secondary'} onClick={() => setAnalyticsMode('overview')}>Overview</Button>
                  <Button type="button" variant={analyticsMode === 'consistency' ? 'primary' : 'secondary'} onClick={() => setAnalyticsMode('consistency')}>Consistency</Button>
                  <Button type="button" variant={analyticsMode === 'exercise-load' ? 'primary' : 'secondary'} onClick={() => setAnalyticsMode('exercise-load')}>Exercise load</Button>
                </div>
              </div>
              <div>
                <Label>Range</Label>
                <select value={range} onChange={(e) => setRange(e.target.value as any)} className="mt-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                  <option value="3d">3d</option>
                  <option value="7d">7d</option>
                  <option value="30d">30d</option>
                  <option value="90d">3mo</option>
                </select>
              </div>
              <div>
                <Label>Category</Label>
                <select value={analyticsCategory} onChange={(e) => setAnalyticsCategory(e.target.value as any)} className="mt-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                  <option value="all">All</option>
                  {DAY_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
                </select>
              </div>
              <div className="w-full md:min-w-[180px] md:grow">
                <Label>Exercise</Label>
                <select value={analyticsExercise} onChange={(e) => setAnalyticsExercise(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                  <option value="all">All exercises</option>
                  {exerciseOptions.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {analyticsMode === 'overview' ? (
            <>
              <div className="grid gap-3 md:grid-cols-5">
                <Card><div className="text-xs text-zinc-500">Sessions</div><div className="mt-1 text-xl font-semibold">{analyticsSessions.length}</div></Card>
                <Card><div className="text-xs text-zinc-500">Sets</div><div className="mt-1 text-xl font-semibold">{analyticsEntries.length}</div></Card>
                <Card><div className="text-xs text-zinc-500">Volume</div><div className="mt-1 text-xl font-semibold">{Math.round(totalVolume)}</div></Card>
                <Card><div className="text-xs text-zinc-500">Avg reps</div><div className="mt-1 text-xl font-semibold">{avgReps.toFixed(1)}</div></Card>
                <Card><div className="text-xs text-zinc-500">Heaviest</div><div className="mt-1 text-xl font-semibold">{heaviest || 0} kg</div></Card>
              </div>

              <Card>
                <div className="text-sm font-semibold text-zinc-900">Category balance by week</div>
                <div className="mt-3 grid gap-2">
                  {weeklyCategory.length === 0 ? <div className="text-sm text-zinc-500">No data in selected range.</div> : weeklyCategory.map((w) => (
                    <div key={w.week} className="grid grid-cols-[80px_1fr_50px] items-center gap-2">
                      <div className="text-xs text-zinc-500">{w.week.slice(5)}</div>
                      <div className="flex h-3 overflow-hidden rounded bg-zinc-100">
                        {DAY_CATEGORIES.map((c) => (
                          <div
                            key={c}
                            style={{ width: `${w.total ? (w.counts[c] / w.total) * 100 : 0}%` }}
                            className={c === 'push' ? 'bg-blue-500' : c === 'cardio' ? 'bg-emerald-500' : c === 'pull' ? 'bg-violet-500' : 'bg-amber-500'}
                          />
                        ))}
                      </div>
                      <div className="text-right text-xs text-zinc-600">{w.total}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}

          {analyticsMode === 'consistency' ? (
            <Card>
              <div className="text-sm font-semibold text-zinc-900">Consistency (how often you train)</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">Sessions/week</div>
                  <div className="mt-1 text-xl font-semibold text-zinc-900">{sessionsPerWeek.toFixed(1)}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">Active days/week</div>
                  <div className="mt-1 text-xl font-semibold text-zinc-900">{activeDaysPerWeek.toFixed(1)}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">Total active days ({range})</div>
                  <div className="mt-1 text-xl font-semibold text-zinc-900">{activeDays.length}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs font-medium text-zinc-500">Calendar heatmap</div>
                <div className="mt-2 grid grid-cols-10 gap-1 md:grid-cols-15">
                  {heatmapDays.map((d) => (
                    <div
                      key={d.day}
                      title={`${d.day}: ${d.count} sets`}
                      className={
                        d.count === 0
                          ? 'h-4 rounded bg-zinc-100'
                          : d.count < 3
                            ? 'h-4 rounded bg-emerald-200'
                            : d.count < 6
                              ? 'h-4 rounded bg-emerald-400'
                              : 'h-4 rounded bg-emerald-600'
                      }
                    />
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {analyticsMode === 'exercise-load' ? (
            <Card>
              <div className="text-sm font-semibold text-zinc-900">Per-exercise load progression</div>
              <p className="mt-1 text-xs text-zinc-500">Load = sum(weight × reps) across sets per day.</p>
              <div className="mt-3 grid gap-3">
                {lineRows.length === 0 ? (
                  <div className="text-sm text-zinc-500">No exercise load data in selected range.</div>
                ) : (
                  lineRows.map((row) => {
                    const w = 520;
                    const h = 120;
                    const pad = 16;
                    const maxY = Math.max(1, ...row.points.map((p) => p.load));
                    const minY = Math.min(...row.points.map((p) => p.load));
                    const span = Math.max(1, maxY - minY);
                    const path = row.points
                      .map((p, i) => {
                        const x = pad + (i * (w - pad * 2)) / Math.max(1, row.points.length - 1);
                        const y = h - pad - ((p.load - minY) / span) * (h - pad * 2);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ');

                    return (
                      <div key={row.exercise} className="rounded-lg border border-zinc-200 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-zinc-900">{row.exercise}</div>
                          <div className={`text-xs ${row.delta >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{row.delta >= 0 ? '+' : ''}{Math.round(row.delta)}</div>
                        </div>
                        <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-28 w-full rounded bg-zinc-50">
                          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-900" />
                          {row.points.map((p, i) => {
                            const x = pad + (i * (w - pad * 2)) / Math.max(1, row.points.length - 1);
                            const y = h - pad - ((p.load - minY) / span) * (h - pad * 2);
                            return <circle key={p.date} cx={x} cy={y} r="2.8" className="fill-zinc-900" />;
                          })}
                        </svg>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{row.points[0]?.date?.slice(5)}</span>
                          <span>{row.points[row.points.length - 1]?.date?.slice(5)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
