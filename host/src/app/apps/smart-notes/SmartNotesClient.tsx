'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button, Card, Input, Label, LinkA } from '@/components/Shell';

type Note = {
  id: number;
  title: string | null;
  body: string | null;
  tags?: string | null;
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

async function apiUpdate(id: number, patch: { title: string; body: string; tags?: string; pinned?: boolean; restore?: boolean }) {
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

function parseTags(raw: string) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeTags(raw: string) {
  return parseTags(raw).join(', ');
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

// Inline markdown renderer - converts markdown patterns to HTML-like display
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const elements: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    // Helper to add text
    const addText = (text: string) => {
      if (text) elements.push(<span key={`${lineIdx}-${key++}`}>{text}</span>);
    };

    // Process inline patterns
    while (remaining.length > 0) {
      // Check for patterns
      const patterns = [
        { regex: /^#{1,6}\s+(.+)$/, type: 'heading' as const },
        { regex: /^\*\*(.+?)\*\*/, type: 'bold' as const },
        { regex: /^__(.+?)__/, type: 'bold' as const },
        { regex: /^\*(.+?)\*/, type: 'italic' as const },
        { regex: /^_(.+?)_/, type: 'italic' as const },
        { regex: /^`(.+?)`/, type: 'code' as const },
        { regex: /^\[(.+?)\]\((.+?)\)/, type: 'link' as const },
        { regex: /^!\[(.+?)\]\((.+?)\)/, type: 'image' as const },
        { regex: /^~~(.+?)~~/, type: 'strike' as const },
      ];

      let matched = false;
      for (const pattern of patterns) {
        const match = remaining.match(pattern.regex);
        if (match) {
          const [fullMatch, ...groups] = match;
          
          switch (pattern.type) {
            case 'heading':
              const level = fullMatch.match(/^#{1,6}/)?.[0].length ?? 1;
              const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs'];
              elements.push(
                <span key={`${lineIdx}-${key++}`} className={`font-bold ${sizes[level - 1]} text-zinc-900`}>
                  {groups[0]}
                </span>
              );
              remaining = remaining.slice(fullMatch.length);
              matched = true;
              break;
            case 'bold':
              elements.push(
                <strong key={`${lineIdx}-${key++}`} className="font-semibold text-zinc-900">{groups[0]}</strong>
              );
              remaining = remaining.slice(fullMatch.length);
              matched = true;
              break;
            case 'italic':
              elements.push(
                <em key={`${lineIdx}-${key++}`} className="italic text-zinc-800">{groups[0]}</em>
              );
              remaining = remaining.slice(fullMatch.length);
              matched = true;
              break;
            case 'code':
              elements.push(
                <code key={`${lineIdx}-${key++}`} className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-mono text-zinc-800">
                  {groups[0]}
                </code>
              );
              remaining = remaining.slice(fullMatch.length);
              matched = true;
              break;
            case 'link':
              elements.push(
                <a key={`${lineIdx}-${key++}`} href={groups[1]} className="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">
                  {groups[0]}
                </a>
              );
              remaining = remaining.slice(fullMatch.length);
              matched = true;
              break;
            case 'strike':
              elements.push(
                <del key={`${lineIdx}-${key++}`} className="text-zinc-500 line-through">{groups[0]}</del>
              );
              remaining = remaining.slice(fullMatch.length);
              matched = true;
              break;
          }
          if (matched) break;
        }
      }

      if (!matched) {
        // No pattern matched, take first char
        addText(remaining[0]);
        remaining = remaining.slice(1);
      }
    }

    return (
      <div key={lineIdx} className="min-h-[1.5em]">
        {elements.length > 0 ? elements : <br />}
      </div>
    );
  });
}

// Inline Markdown Editor Component
function InlineMarkdownEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync scroll between textarea and preview
  const handleScroll = () => {
    if (textareaRef.current && previewRef.current) {
      previewRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      // Set cursor position after tab
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="relative min-h-[300px] rounded-lg border border-zinc-200 bg-white overflow-hidden">
      {/* Preview layer - shown behind textarea */}
      <div
        ref={previewRef}
        className="absolute inset-0 p-3 overflow-y-auto pointer-events-none"
        style={{ fontFamily: 'inherit' }}
      >
        {value ? (
          <div className="text-sm text-zinc-700 whitespace-pre-wrap">
            {renderInlineMarkdown(value)}
          </div>
        ) : (
          <span className="text-zinc-400 text-sm">{placeholder || 'Write something...'}</span>
        )}
      </div>
      
      {/* Textarea layer - transparent but captures input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full p-3 text-sm text-transparent bg-transparent caret-zinc-900 resize-none outline-none"
        spellCheck={false}
        style={{ 
          fontFamily: 'inherit',
          lineHeight: '1.5',
        }}
      />
      
      {/* Focus indicator */}
      <div className={`absolute inset-0 border-2 rounded-lg pointer-events-none transition-colors ${isFocused ? 'border-zinc-900/20' : 'border-transparent'}`} />
    </div>
  );
}

export function SmartNotesClient({ initialNotes }: { initialNotes: Note[] }) {
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState<Note[]>(sortNotes(initialNotes));
  const [selectedId, setSelectedId] = useState<number | null>(initialNotes[0]?.id ?? null);
  const [current, setCurrent] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [isMobile, setIsMobile] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; action?: { label: string; onClick: () => void } } | null>(null);
  const [isPending, startTransition] = useTransition();

  const debounceRef = useRef<any>(null);
  const lastSavedRef = useRef<{ title: string; body: string; tags: string }>({ title: '', body: '', tags: '' });

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
        setTags(note.tags ?? '');
        lastSavedRef.current = { title: note.title ?? '', body: note.body ?? '', tags: note.tags ?? '' };
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
      if (!mobile) setView('editor');
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scheduleSave = (nextTitle: string, nextBody: string, nextTags: string) => {
    if (!selectedId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSaveError(null);
    setSaveState('dirty');
    debounceRef.current = setTimeout(async () => {
      try {
        if (!isOnline()) throw new Error('Offline');
        setSaveState('saving');
        await apiUpdate(selectedId, { title: nextTitle, body: nextBody, tags: normalizeTags(nextTags) });
        lastSavedRef.current = { title: nextTitle, body: nextBody, tags: normalizeTags(nextTags) };
        setSaveState('saved');
        setNotes((prev) =>
          sortNotes(
            prev.map((n) =>
              n.id === selectedId ? { ...n, title: nextTitle, body: nextBody, tags: normalizeTags(nextTags), updated_at: new Date().toISOString() } : n
            )
          )
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
    scheduleSave(v, body, tags);
  };

  const onChangeBody = (v: string) => {
    setBody(v);
    scheduleSave(title, v, tags);
  };

  const onChangeTags = (v: string) => {
    setTags(v);
    scheduleSave(title, body, v);
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

  const startVoice = async () => {
    try {
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
      if (rec.state === 'recording') {
        try {
          rec.requestData();
        } catch {}
        rec.stop();
      } else {
        resolve();
      }
    });

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
      await apiUpdate(selectedId, { title, body, tags: normalizeTags(tags) });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 800);
    } catch (e: any) {
      setSaveState('error');
      setSaveError(String(e?.message ?? e));
    }
  };

  const ListPane = (
    <div className="space-y-3">
      <Card>
        <Label>Search</Label>
        <div className="mt-2 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title/body/tags" />
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

      <div className="flex items-center justify-between gap-2">
        <LinkA href="/apps/smart-notes/trash" className="rounded-md border border-zinc-200 px-2 py-1 text-xs">
          Trash
        </LinkA>
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
                  <div className="mt-1 truncate text-xs text-zinc-500">{highlight(clampPreview(n.body ?? ''), q)}</div>
                  {n.tags?.trim() ? <div className="mt-1 truncate text-[11px] text-zinc-500">🏷 {n.tags}</div> : null}
                </div>
                <div className="text-xs text-zinc-400">#{n.id}</div>
              </div>
            </button>
          );
        })}

        {notes.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-600">No notes yet. Tap "New" to create one.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );

  const EditorPane = (
    <div className="space-y-3">
      {saveError ? (
        <Card>
          <p className="text-sm font-medium text-zinc-900">Couldn't save</p>
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
                  await apiUpdate(selectedId, { title, body, tags: normalizeTags(tags), pinned: next });
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
        <Card>
          <p className="text-sm text-zinc-600">Select a note.</p>
        </Card>
      ) : (
        <>
          <Card>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => onChangeTitle(e.target.value)} placeholder="Title" />

            <div className="mt-3">
              <Label>Tags</Label>
              <Input value={tags} onChange={(e) => onChangeTags(e.target.value)} placeholder="ideas, location:home, time:morning" />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const tag = `time:${new Date().toLocaleString()}`;
                    const next = normalizeTags([tags, tag].filter(Boolean).join(', '));
                    onChangeTags(next);
                  }}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  + time
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator?.geolocation) return;
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const tag = `gps:${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`;
                        const next = normalizeTags([tags, tag].filter(Boolean).join(', '));
                        onChangeTags(next);
                      },
                      () => {
                        setSnack({ msg: 'Location permission denied' });
                        setTimeout(() => setSnack(null), 2000);
                      },
                      { enableHighAccuracy: false, timeout: 8000 }
                    );
                  }}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  + gps
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <Label>Note</Label>
                <span className="text-xs text-zinc-400">Type **bold**, *italic*, `code`, # heading</span>
              </div>
              <InlineMarkdownEditor
                value={body}
                onChange={onChangeBody}
                placeholder="Write in Markdown… patterns render inline as you type"
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className={view === 'editor' && isMobile ? 'hidden' : ''}>{ListPane}</div>
        <div className={view === 'list' && isMobile ? 'hidden' : ''}>{EditorPane}</div>
      </div>

      {isMobile ? (
        <button
          type="button"
          onClick={onNew as any}
          aria-label="New note"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+2.25rem)] right-4 z-[70] inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-2xl leading-none text-white shadow-lg md:hidden"
        >
          +
        </button>
      ) : null}

      {snack ? (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg">
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
