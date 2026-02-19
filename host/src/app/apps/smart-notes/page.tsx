import { Shell } from '@/components/Shell';
import { dbQuery } from '@/lib/db';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';
import Link from 'next/link';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

export default async function SmartNotesListPage() {
  ensureSmartNotesSchema();
  const rows = dbQuery<any>(
    APP_ID,
    `SELECT id, title, body, tags, created_at, updated_at, pinned
     FROM notes
     WHERE deleted_at IS NULL
     ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT 50`
  );

  const notes = rows.map((r: any) => ({
    id: Number(r.id),
    title: r.title ?? null,
    body: r.body ?? null,
    tags: r.tags ?? null,
    created_at: String(r.created_at),
    updated_at: r.updated_at ?? null,
    pinned: Number(r.pinned ?? 0)
  }));

  function stripHtml(html: string) {
    if (!html) return '';
    return html.replace(/<[^\u003e]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function clampPreview(s: string, n = 80) {
    const t = s.trim().replace(/\s+/g, ' ');
    if (!t) return '';
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  return (
    <Shell title="Smart Notes" subtitle="All your notes">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link 
            href="/apps/smart-notes/trash"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            🗑 Trash
          </Link>
          <Link
            href="/apps/smart-notes/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            + New Note
          </Link>
        </div>

        <div className="grid gap-3">
          {notes.map((n) => {
            const plainBody = clampPreview(stripHtml(n.body ?? ''));
            return (
              <Link
                key={n.id}
                href={`/apps/smart-notes/${n.id}`}
                className="block w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-zinc-900">
                        {n.title?.trim() || 'Untitled'}
                      </h3>
                      {n.pinned ? (
                        <span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          📌 Pinned
                        </span>
                      ) : null}
                    </div>
                    {plainBody ? (
                      <p className="mt-1 truncate text-sm text-zinc-500">{plainBody}</p>
                    ) : null}
                    {n.tags?.trim() ? (
                      <p className="mt-2 text-xs text-zinc-400">{n.tags}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs text-zinc-400">
                    #{n.id}
                  </div>
                </div>
              </Link>
            );
          })}

          {notes.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
              <p className="text-zinc-600">No notes yet.</p>
              <Link
                href="/apps/smart-notes/new"
                className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Create your first note
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
