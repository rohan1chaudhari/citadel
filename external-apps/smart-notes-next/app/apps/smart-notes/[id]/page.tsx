import { Shell } from '@/components/Shell';
import { dbQuery, dbExec } from '@/lib/db';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorClient } from './EditorClient';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  ensureSmartNotesSchema();
  const { id } = await params;
  const noteId = parseInt(id, 10);
  
  if (!Number.isFinite(noteId)) {
    notFound();
  }

  const rows = dbQuery<any>(
    APP_ID,
    `SELECT id, title, body, tags, created_at, updated_at, pinned
     FROM notes
     WHERE id = ? AND deleted_at IS NULL`,
    [noteId]
  );

  if (!rows.length) {
    notFound();
  }

  const note = {
    id: Number(rows[0].id),
    title: rows[0].title ?? '',
    body: rows[0].body ?? '',
    tags: rows[0].tags ?? '',
    created_at: String(rows[0].created_at),
    updated_at: rows[0].updated_at ?? null,
    pinned: Number(rows[0].pinned ?? 0)
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Full-width header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/apps/smart-notes"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                ← Back
              </Link>
              <span className="text-xs text-zinc-400">Note #{note.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/apps/smart-notes/new"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                + New
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Full-page editor */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        <EditorClient note={note} />
      </main>
    </div>
  );
}
