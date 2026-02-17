'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Card, Input, Label } from '@/components/Shell';

type Note = {
  id: number;
  title: string | null;
  body: string | null;
  created_at: string;
  updated_at?: string | null;
  pinned?: number;
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function isOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

async function apiList(q: string): Promise<Note[]> {
  const url = new URL('/api/apps/smart-notes/notes', window.location.origin);
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.notes as Note[];
}

async function apiCreate(): Promise<number> {
  const res = await fetch('/api/apps/smart-notes/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '', body: '' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.id as number;
}

async function apiGet(id: number): Promise<Note> {
  const res = await fetch(`/api/apps/smart-notes/notes/${id}`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.note as Note;
}

async function apiUpdate(id: number, patch: { title: string; body: string; pinned?: boolean; restore?: boolean }) {
  const res = await fetch(`/api/apps/smart-notes/notes/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
}

async function apiDelete(id: number) {
  const res = await fetch(`/api/apps/smart-notes/notes/${id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
}

function clampPreview(s: string, n = 80) {
  const t = s.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.length > n ? t.slice(0, n) + '…' : t;
}

function highlight(text: string, q: string) {
  const needle = q.trim();
  if (!needle) return text;
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + needle.length);
  const after = text.slice(idx + needle.length);
  return (
    <>
      {before}
      <mark className="rounded bg-yellow-100 px-1 text-zinc-900">{match}</mark>
      {after}
    </>
  );
}

function sortNotes(list: Note[]) {
  const ts = (n: Note) => {
    const t = (n.updated_at ?? n.created_at) as string;
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : 0;
  };
  return [...list].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (bp !== ap) return bp - ap;
    const dt = ts(b) - ts(a);
    if (dt !== 0) return dt;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

export function SmartNotesClient({ initialNotes }: { initialNotes: Note[] }) {
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState<Note[]>(sortNotes(initialNotes));
  const [selectedId, setSelectedId] = useState<number | null>(initialNotes[0]?.id ?? null);
  const [current, setCurrent] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [isMobile, setIsMobile] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; action?: { label: string; onClick: () => void } } | null>(null);
  const [isPending, startTransition] = useTransition();

  const debounceRef = useRef<any>(null);
  const lastSavedRef = useRef<{ title: string; body: string }>({ title: '', body: '' });

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedId) {
        setCurrent(null);
        return;
      }
      try {
        const note = await apiGet(selectedId);
        if (cancelled) return;
        setCurrent(note);
        setTitle(note.title ?? '');
        setBody(note.body ?? '');
        lastSavedRef.current = { title: note.title ?? '', body: note.body ?? '' };
        setSaveError(null);
        setSaveState('idle');
      } catch (e: any) {
        if (!cancelled) {
          setSaveState('error');
          setSaveError(String(e?.message ?? e));
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // On large screens, show editor view (split pane).
      if (!mobile) setView('editor');
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    if (!selectedId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSaveError(null);
    setSaveState('dirty');
    debounceRef.current = setTimeout(async () => {
      try {
        if (!isOnline()) throw new Error('Offline');
        setSaveState('saving');
        await apiUpdate(selectedId, { title: nextTitle, body: nextBody });
        lastSavedRef.current = { title: nextTitle, body: nextBody };
        setSaveState('saved');
        setNotes((prev) =>
          sortNotes(prev.map((n) => (n.id === selectedId ? { ...n, title: nextTitle, body: nextBody, updated_at: new Date().toISOString() } : n)))
        );
        setTimeout(() => setSaveState('idle'), 800);
      } catch (e: any) {
        setSaveState('error');
        setSaveError(String(e?.message ?? e));
      }
    }, 300);
  };

  const onChangeTitle = (v: string) => {
    setTitle(v);
    scheduleSave(v, body);
  };

  const onChangeBody = (v: string) => {
    setBody(v);
    scheduleSave(title, v);
  };

  const refreshList = async () => {
    const list = await apiList(q);
    const sorted = sortNotes(list);
    startTransition(() => {
      setNotes(sorted);
      if (!selectedId && sorted[0]?.id) setSelectedId(sorted[0].id);
    });
  };

  const onSearch = async () => {
    const list = await apiList(q);
    startTransition(() => {
      setNotes(sortNotes(list));
    });
  };

  const onNew = async () => {
    const id = await apiCreate();
    const note = await apiGet(id);
    setNotes((prev) => sortNotes([note as any, ...prev]));
    setSelectedId(id);
    setView('editor');
  };

  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'uploading' | 'processing' | 'error'>('idle');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const deferredBody = useDeferredValue(body);

  const startVoice = async () => {
    try {
      // If a previous upload is in flight, cancel it before starting a new recording.
      uploadAbortRef.current?.abort();
      uploadAbortRef.current = null;

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

  const stopVoice = async () => {
    const rec = mediaRef.current;
    if (!rec) return;

    setVoiceState('uploading');

    await new Promise<void>((resolve) => {
      rec.addEventListener('stop', () => resolve(), { once: true });
      // Flush final chunk quickly before stopping.
      if (rec.state === 'recording') {
        try {
          rec.requestData();
        } catch {}
        rec.stop();
      } else {
        resolve();
      }
    });

    // Ensure mic capture is actually cut off immediately.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `voice.webm`, { type: 'audio/webm' });
      const fd = new FormData();
      fd.set('audio', file);

      const controller = new AbortController();
      uploadAbortRef.current = controller;

      const res = await fetch('/api/apps/smart-notes/voice', {
        method: 'POST',
        body: fd,
        signal: controller.signal
      });
      setVoiceState('processing');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);

      const id = Number((data as any).id);
      await refreshList();
      if (Number.isFinite(id)) {
        setSelectedId(id);
        setView('editor');
      }
      setVoiceState('idle');
      mediaRef.current = null;
      uploadAbortRef.current = null;
    } catch {
      setVoiceState('error');
      mediaRef.current = null;
      uploadAbortRef.current = null;
    }
  };

  const cancelVoice = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;

    try {
      if (mediaRef.current?.state === 'recording') {
        mediaRef.current.stop();
      }
    } catch {}
    mediaRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    setVoiceState('idle');
  };

  const onSelect = (id: number) => {
    setSelectedId(id);
    if (isMobile) setView('editor');
  };

  const onDelete = async () => {
    if (!selectedId) return;
    try {
      const deletedId = selectedId;
      await apiDelete(deletedId);

      // Optimistic remove from list
      const remaining = notes.filter((n) => n.id !== deletedId);
      setNotes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      if (isMobile) setView('list');

      setSnack({
        msg: 'Moved to Trash',
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await apiUpdate(deletedId, { title: title, body: body, restore: true });
              setSnack({ msg: 'Restored' });
              await refreshList();
              setSelectedId(deletedId);
              if (isMobile) setView('editor');
            } catch (e) {
              setSnack({ msg: 'Failed to restore' });
            }
          }
        }
      });
      setTimeout(() => setSnack(null), 4000);
    } catch (e: any) {
      setSaveState('error');
      setSaveError(String(e?.message ?? e));
    }
  };

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      if (mediaRef.current?.state === 'recording') {
        try {
          mediaRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const statusText =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : saveState === 'error'
          ? 'Save failed'
          : saveState === 'dirty'
            ? 'Unsaved changes'
            : '';

  const retrySave = async () => {
    if (!selectedId) return;
    try {
      setSaveState('saving');
      setSaveError(null);
      await apiUpdate(selectedId, { title, body });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 800);
    } catch (e: any) {
      setSaveState('error');
      setSaveError(String(e?.message ?? e));
    }
  };

  const ListPane = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-500">Notes</div>
        <div className="flex items-center gap-2">
          {voiceState === 'recording' ? (
            <Button type="button" variant="danger" onClick={stopVoice as any}>
              Stop
            </Button>
          ) : voiceState === 'uploading' || voiceState === 'processing' ? (
            <Button type="button" variant="danger" onClick={cancelVoice as any}>
              Cancel voice
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={startVoice as any}>
              Voice
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onNew as any}>
            New
          </Button>
        </div>
      </div>

      <Card className="analog-paper-card">
        <Label>Search</Label>
        <div className="mt-2 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title/body" />
          <Button type="button" variant="secondary" onClick={onSearch as any} disabled={isPending}>
            {isPending ? '…' : 'Go'}
          </Button>
        </div>
        {voiceState !== 'idle' ? (
          <p className="mt-2 text-xs text-zinc-500">
            Voice: {voiceState === 'recording' ? 'recording…' : voiceState === 'uploading' ? 'uploading…' : voiceState === 'processing' ? 'processing…' : 'error'}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-2">
        {notes.map((n) => {
          const active = n.id === selectedId;
          return (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              className={`analog-note-item text-left rounded-xl border p-3 transition ${
                active ? 'border-amber-900/40 bg-amber-50/90' : 'border-amber-900/20 bg-amber-50/70 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-zinc-900">
                      {n.title?.trim() ? highlight(n.title, q) : 'Untitled'}
                    </div>
                    {n.pinned ? (
                      <span className="inline-flex shrink-0 items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-500">
                    {highlight(clampPreview(n.body ?? ''), q)}
                  </div>
                </div>
                <div className="text-xs text-zinc-400">#{n.id}</div>
              </div>
            </button>
          );
        })}

        {notes.length === 0 ? (
          <Card className="analog-paper-card">
            <p className="text-sm text-zinc-600">No notes yet. Tap “New” to create one.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );

  const EditorPane = (
    <div className="space-y-3">
      {saveError ? (
        <Card className="analog-paper-card">
          <p className="text-sm font-medium text-zinc-900">Couldn’t save</p>
          <p className="mt-1 text-xs text-zinc-600">{saveError}</p>
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={retrySave as any}>
              Retry
            </Button>
          </div>
        </Card>
      ) : null}
      <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile ? (
              <Button type="button" variant="secondary" onClick={() => setView('list') as any}>
                Back
              </Button>
            ) : null}
            <div className="text-xs text-zinc-500">{selected ? `#${selected.id}` : ''}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-500">{statusText}</div>
            {saveState === 'error' ? (
              <Button type="button" variant="secondary" onClick={retrySave as any}>
                Retry
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                if (!selectedId) return;
                const next = !(current?.pinned ? true : false);
                try {
                  await apiUpdate(selectedId, { title, body, pinned: next });
                  const now = new Date().toISOString();
                  setNotes((prev) =>
                    sortNotes(prev.map((n) => (n.id === selectedId ? { ...n, pinned: next ? 1 : 0, updated_at: now } : n)))
                  );
                  setCurrent((c) => (c ? { ...c, pinned: next ? 1 : 0, updated_at: now } : c));
                } catch (e: any) {
                  setSaveState('error');
                  setSaveError(String(e?.message ?? e));
                }
              }}
            >
              {current?.pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button type="button" variant="danger" onClick={onDelete as any}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      {!selectedId ? (
        <Card className="analog-paper-card">
          <p className="text-sm text-zinc-600">Select a note.</p>
        </Card>
      ) : (
        <>
          <Card className="analog-paper-card">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => onChangeTitle(e.target.value)} placeholder="Title" />
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <Label>Markdown</Label>
                <div className="flex items-center gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileTab('edit')}
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      mobileTab === 'edit' ? 'border-zinc-900 text-zinc-900' : 'border-zinc-200 text-zinc-600'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab('preview')}
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      mobileTab === 'preview' ? 'border-zinc-900 text-zinc-900' : 'border-zinc-200 text-zinc-600'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>
              <textarea
                value={body}
                onChange={(e) => onChangeBody(e.target.value)}
                placeholder="Write in Markdown…"
                className={"analog-note-body mt-2 h-56 w-full rounded-lg border border-amber-900/20 bg-amber-50/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-900/20 " + (mobileTab === 'preview' ? 'hidden md:block' : '')}
              />
            </div>
          </Card>

          <Card className={`analog-paper-card ${mobileTab === 'edit' ? 'hidden md:block' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-zinc-500">Preview</div>
              <Button type="button" variant="secondary" onClick={refreshList as any}>
                Refresh list
              </Button>
            </div>
            <div className="prose prose-zinc mt-3 max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{deferredBody || '_Nothing to preview yet._'}</ReactMarkdown>
            </div>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="smart-notes-analog-inner grid gap-6 md:grid-cols-[320px_1fr]">
        <div className={view === 'editor' && isMobile ? 'hidden' : ''}>{ListPane}</div>
        <div className={view === 'list' && isMobile ? 'hidden' : ''}>{EditorPane}</div>
      </div>

      {snack ? (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-amber-900/20 bg-amber-50 px-4 py-3 shadow-lg">
          <div className="text-sm text-zinc-900">{snack.msg}</div>
          {snack.action ? (
            <button
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              onClick={() => snack.action?.onClick()}
            >
              {snack.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
