'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Card, Input, Label } from '@/components/Shell';

type Note = {
  id: number;
  title: string | null;
  body: string | null;
  created_at: string;
  updated_at?: string | null;
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

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

async function apiUpdate(id: number, patch: { title: string; body: string }) {
  const res = await fetch(`/api/apps/smart-notes/notes/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
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

export function SmartNotesClient({ initialNotes }: { initialNotes: Note[] }) {
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<number | null>(initialNotes[0]?.id ?? null);
  const [current, setCurrent] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [view, setView] = useState<'list' | 'editor'>('list');

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
        setSaveState('idle');
      } catch {
        if (!cancelled) setSaveState('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const onResize = () => {
      // On large screens, always show editor view (split pane). On small, keep current view.
      if (window.innerWidth >= 768) setView('editor');
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    if (!selectedId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSaveState('dirty');
    debounceRef.current = setTimeout(async () => {
      try {
        setSaveState('saving');
        await apiUpdate(selectedId, { title: nextTitle, body: nextBody });
        lastSavedRef.current = { title: nextTitle, body: nextBody };
        setSaveState('saved');
        // refresh list titles/previews
        setNotes((prev) =>
          prev.map((n) => (n.id === selectedId ? { ...n, title: nextTitle, body: nextBody, updated_at: new Date().toISOString() } : n))
        );
        setTimeout(() => setSaveState('idle'), 800);
      } catch {
        setSaveState('error');
      }
    }, 600);
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
    setNotes(list);
    if (!selectedId && list[0]?.id) setSelectedId(list[0].id);
  };

  const onSearch = async () => {
    const list = await apiList(q);
    setNotes(list);
  };

  const onNew = async () => {
    const id = await apiCreate();
    const note = await apiGet(id);
    // put on top
    setNotes((prev) => [note as any, ...prev]);
    setSelectedId(id);
    setView('editor');
  };

  const onSelect = (id: number) => {
    setSelectedId(id);
    if (window.innerWidth < 768) setView('editor');
  };

  const onDelete = async () => {
    if (!selectedId) return;
    const ok = window.confirm('Move this note to trash?');
    if (!ok) return;
    try {
      await apiDelete(selectedId);
      const remaining = notes.filter((n) => n.id !== selectedId);
      setNotes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      if (window.innerWidth < 768) setView('list');
    } catch {
      setSaveState('error');
    }
  };

  const statusText =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : saveState === 'error'
          ? 'Error'
          : saveState === 'dirty'
            ? 'Unsaved changes'
            : '';

  const ListPane = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-500">Notes</div>
        <Button type="button" variant="secondary" onClick={onNew as any}>
          New
        </Button>
      </div>

      <Card>
        <Label>Search</Label>
        <div className="mt-2 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title/body" />
          <Button type="button" variant="secondary" onClick={onSearch as any}>
            Go
          </Button>
        </div>
      </Card>

      <div className="grid gap-2">
        {notes.map((n) => {
          const active = n.id === selectedId;
          return (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              className={`text-left rounded-xl border p-3 transition ${
                active ? 'border-zinc-900 bg-white' : 'border-zinc-200 bg-white hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">{n.title?.trim() ? n.title : 'Untitled'}</div>
                  <div className="mt-1 truncate text-xs text-zinc-500">{clampPreview(n.body ?? '')}</div>
                </div>
                <div className="text-xs text-zinc-400">#{n.id}</div>
              </div>
            </button>
          );
        })}

        {notes.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-600">No notes yet. Tap “New” to create one.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );

  const EditorPane = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {window?.innerWidth < 768 ? (
            <Button type="button" variant="secondary" onClick={() => setView('list') as any}>
              Back
            </Button>
          ) : null}
          <div className="text-xs text-zinc-500">{selected ? `#${selected.id}` : ''}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-zinc-500">{statusText}</div>
          <Button type="button" variant="danger" onClick={onDelete as any}>
            Delete
          </Button>
        </div>
      </div>

      {!selectedId ? (
        <Card>
          <p className="text-sm text-zinc-600">Select a note.</p>
        </Card>
      ) : (
        <>
          <Card>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => onChangeTitle(e.target.value)} placeholder="Title" />
            <div className="mt-3">
              <Label>Markdown</Label>
              <textarea
                value={body}
                onChange={(e) => onChangeBody(e.target.value)}
                placeholder="Write in Markdown…"
                className="mt-2 h-56 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-zinc-500">Preview</div>
              <Button type="button" variant="secondary" onClick={refreshList as any}>
                Refresh list
              </Button>
            </div>
            <div className="prose prose-zinc mt-3 max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body || '_Nothing to preview yet._'}</ReactMarkdown>
            </div>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <div className={view === 'editor' && typeof window !== 'undefined' && window.innerWidth < 768 ? 'hidden' : ''}>{ListPane}</div>
      <div className={view === 'list' && typeof window !== 'undefined' && window.innerWidth < 768 ? 'hidden' : ''}>{EditorPane}</div>
    </div>
  );
}
