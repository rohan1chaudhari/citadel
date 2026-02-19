'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Input, Label } from '@/components/Shell';
import { TiptapEditor } from '@/components/TiptapEditor';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Note = {
  id: number;
  title: string;
  body: string;
  tags: string;
  created_at: string;
  updated_at: string | null;
  pinned: number;
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function EditorClient({ note }: { note: Note }) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags);
  const [pinned, setPinned] = useState(note.pinned === 1);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef({ title: note.title, body: note.body, tags: note.tags });

  const scheduleSave = (nextTitle: string, nextBody: string, nextTags: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSaveError(null);
    setSaveState('dirty');
    
    debounceRef.current = setTimeout(async () => {
      try {
        setSaveState('saving');
        const res = await fetch(`/api/apps/smart-notes/notes/${note.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: nextTitle,
            body: nextBody,
            tags: nextTags,
          }),
        });
        
        if (!res.ok) throw new Error('Save failed');
        
        lastSavedRef.current = { title: nextTitle, body: nextBody, tags: nextTags };
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 1000);
      } catch (e: any) {
        setSaveState('error');
        setSaveError(e?.message || 'Save failed');
      }
    }, 500);
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

  const onTogglePin = async () => {
    try {
      const next = !pinned;
      const res = await fetch(`/api/apps/smart-notes/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          tags,
          pinned: next,
        }),
      });
      if (!res.ok) throw new Error('Failed to pin');
      setPinned(next);
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to pin');
    }
  };

  const onDelete = async () => {
    try {
      const res = await fetch(`/api/apps/smart-notes/notes/${note.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      router.push('/apps/smart-notes');
    } catch (e: any) {
      setSaveError(e?.message || 'Delete failed');
      setShowDeleteConfirm(false);
    }
  };

  const statusText =
    saveState === 'saving' ? 'Saving…' :
    saveState === 'saved' ? 'Saved' :
    saveState === 'error' ? 'Error' :
    saveState === 'dirty' ? 'Unsaved' : '';

  // Add keyboard shortcut for save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        // Trigger immediate save by clearing debounce
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        scheduleSave(title, body, tags);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [title, body, tags]);

  return (
    <div className="space-y-6">
      {/* Status bar */}
      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Title */}
      <div>
        <Input
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="Note title..."
          className="text-xl font-semibold"
        />
      </div>

      {/* Tags & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <Label>Tags</Label>
          <Input
            value={tags}
            onChange={(e) => onChangeTags(e.target.value)}
            placeholder="ideas, work, personal"
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onTogglePin}
          >
            {pinned ? '📌 Pinned' : '📌 Pin'}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Content</Label>
          <span className="text-xs text-zinc-400">{statusText}</span>
        </div>
        <TiptapEditor
          value={body}
          onChange={onChangeBody}
          placeholder="Start writing..."
        />
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Delete note?</h3>
            <p className="mt-2 text-sm text-zinc-600">
              This will move the note to trash. You can restore it later.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={onDelete}
                className="flex-1"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
