import { Button, Card, Input, Label, LinkA, Shell, Textarea } from '@/components/Shell';

type Note = { id: number; title: string | null; body: string | null; created_at: string };

async function fetchNotes(q: string) {
  const url = new URL('http://localhost:3000/api/apps/smart-notes/notes');
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as { ok: true; notes: Note[]; q: string };
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">New note</h2>
              <p className="mt-1 text-sm text-zinc-600">Local-first. Stored in your Smart Notes app DB.</p>
            </div>
            <div className="text-xs text-zinc-500">MVP A</div>
          </div>

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
          <form action="/apps/smart-notes" method="get" className="mt-3 flex gap-2">
            <Input name="q" defaultValue={data.q} placeholder="Search title or body" />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
          {data.q ? (
            <p className="mt-2 text-sm text-zinc-600">
              Filtering by: <code className="rounded bg-zinc-100 px-1 py-0.5">{data.q}</code> ·{' '}
              <a className="text-zinc-900 underline" href="/apps/smart-notes">
                clear
              </a>
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
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{n.title?.trim() ? n.title : '(untitled)'}</div>
                    <div className="mt-1 text-xs text-zinc-500">#{n.id} · {n.created_at}</div>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-zinc-700 hover:text-zinc-900">Edit</summary>
                    <form action={`/api/apps/smart-notes/notes/${n.id}/update`} method="post" className="mt-3 space-y-3">
                      <div>
                        <Label>Title</Label>
                        <Input name="title" defaultValue={n.title ?? ''} />
                      </div>
                      <div>
                        <Label>Body</Label>
                        <Textarea name="body" defaultValue={n.body ?? ''} rows={5} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="submit" variant="primary">Save</Button>
                        <Button type="reset" variant="secondary">Reset</Button>
                      </div>
                    </form>
                  </details>
                </div>

                {n.body ? <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{n.body}</div> : null}

                <form action={`/api/apps/smart-notes/notes/${n.id}/delete`} method="post" className="mt-4">
                  <Button type="submit" variant="danger">Delete</Button>
                </form>
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
