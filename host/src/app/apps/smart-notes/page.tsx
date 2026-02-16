import { Button, Card, Input, Label, LinkA, Shell, Textarea } from '@/components/Shell';

type Note = { id: number; title: string | null; body: string | null; created_at: string };

async function fetchNotes(q: string) {
  const url = new URL('http://localhost:3000/api/apps/smart-notes/notes');
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as { ok: true; notes: Note[]; q: string };
}

function preview(body: string | null) {
  const t = (body ?? '').trim();
  if (!t) return '';
  return t.length > 140 ? t.slice(0, 140) + '…' : t;
}

export default async function SmartNotesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ?? '';
  const data = await fetchNotes(q);

  return (
    <Shell title="Smart Notes" subtitle="Capture fast. Find later.">
      <div className="flex items-center justify-between">
        <LinkA href="/">← home</LinkA>
        <div className="text-xs text-zinc-500">{data.notes.length} shown</div>
      </div>

      <div className="grid gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-zinc-900">New note</h2>
          <form action="/api/apps/smart-notes/notes" method="post" className="mt-4 space-y-3">
            <div>
              <Label>Title</Label>
              <Input name="title" placeholder="Title" />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea name="body" placeholder="Write…" rows={5} />
            </div>
            <Button type="submit">Add note</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-zinc-900">Search</h2>
          <form action="/apps/smart-notes" method="get" className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input name="q" defaultValue={data.q} placeholder="Search title or body" />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
          {data.q ? (
            <p className="mt-2 text-sm text-zinc-600">
              Filtering by: <code className="rounded bg-zinc-100 px-1 py-0.5">{data.q}</code> ·{' '}
              <a className="text-zinc-900 underline" href="/apps/smart-notes">clear</a>
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">Tip: try searching for a phrase you wrote.</p>
          )}
        </Card>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Recent</h2>
            <div className="text-xs text-zinc-500">Newest first</div>
          </div>

          <div className="mt-3 grid gap-3">
            {data.notes.map((n) => (
              <Card key={n.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <a className="block truncate text-sm font-semibold text-zinc-900 hover:underline" href={`/apps/smart-notes/${n.id}`}>
                      {n.title?.trim() ? n.title : 'Untitled note'}
                    </a>
                    <div className="mt-1 text-xs text-zinc-500">#{n.id} · {n.created_at}</div>
                  </div>
                  <div className="shrink-0">
                    <LinkA href={`/apps/smart-notes/${n.id}`}>Open →</LinkA>
                  </div>
                </div>
                {preview(n.body) ? <div className="mt-3 text-sm text-zinc-700">{preview(n.body)}</div> : null}
              </Card>
            ))}

            {data.notes.length === 0 ? (
              <Card>
                <p className="text-sm text-zinc-600">No notes yet. Create your first one above.</p>
              </Card>
            ) : null}
          </div>
        </div>

        <div className="text-sm text-zinc-600">
          <LinkA href="/api/apps/smart-notes/health" target="_blank" rel="noreferrer">health</LinkA>
          {' · '}
          <LinkA href="/api/apps/smart-notes/selftest" target="_blank" rel="noreferrer">selftest</LinkA>
        </div>
      </div>
    </Shell>
  );
}
