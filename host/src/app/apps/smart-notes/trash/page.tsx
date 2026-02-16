import { Button, Card, LinkA, Shell } from '@/components/Shell';
import { dbExec, dbQuery } from '@/lib/db';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      created_at TEXT NOT NULL
    )`
  );
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN updated_at TEXT`);
  } catch {}
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN deleted_at TEXT`);
  } catch {}
}

export default async function TrashPage() {
  ensureSchema();
  const rows = dbQuery<any>(
    APP_ID,
    `SELECT id, title, body, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC, id DESC
     LIMIT 200`
  );

  const notes = rows.map((r: any) => ({
    id: Number(r.id),
    title: r.title ?? null,
    body: r.body ?? null,
    deleted_at: String(r.deleted_at)
  }));

  return (
    <Shell title="Trash" subtitle="Recently deleted notes">
      <div className="flex items-center justify-between">
        <LinkA href="/apps/smart-notes">← back to notes</LinkA>
        <div className="text-xs text-zinc-500">{notes.length} item(s)</div>
      </div>

      <div className="grid gap-3">
        {notes.map((n) => (
          <Card key={n.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{n.title?.trim() ? n.title : 'Untitled note'}</div>
                <div className="mt-1 text-xs text-zinc-500">#{n.id} · deleted {n.deleted_at}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={`/api/apps/smart-notes/notes/${n.id}/restore`} method="post">
                  <Button type="submit" variant="secondary">Restore</Button>
                </form>
                <form action={`/api/apps/smart-notes/notes/${n.id}/purge`} method="post">
                  <Button type="submit" variant="danger">Delete forever</Button>
                </form>
              </div>
            </div>
          </Card>
        ))}

        {notes.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-600">Trash is empty.</p>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
