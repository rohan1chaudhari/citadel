import { listApps } from '@/lib/registry';

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
  const apps = await listApps();

  return (
    <main>
      <p>
        <a href="/">← home</a>
      </p>
      <h1>Smart Notes</h1>
      <p style={{ opacity: 0.7 }}>MVP: capture + list + search + edit + delete</p>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <h2>New note</h2>
        <form action="/api/apps/smart-notes/notes" method="post">
          <div>
            <label>
              Title
              <input name="title" placeholder="Title" style={{ display: 'block', width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>
              Body
              <textarea name="body" placeholder="Write…" rows={5} style={{ display: 'block', width: '100%' }} />
            </label>
          </div>
          <button type="submit" style={{ marginTop: 8 }}>Add note</button>
        </form>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Search</h2>
        <form action="/apps/smart-notes" method="get">
          <input name="q" value={data.q} placeholder="search title/body" style={{ width: '60%' }} />
          <button type="submit">Search</button>
          {data.q ? (
            <a href="/apps/smart-notes" style={{ marginLeft: 8 }}>clear</a>
          ) : null}
        </form>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Recent {data.q ? '(filtered)' : ''}</h2>
        <ul style={{ paddingLeft: 18 }}>
          {data.notes.map((n) => (
            <li key={n.id} style={{ marginBottom: 16 }}>
              <div>
                <strong>{n.title?.trim() ? n.title : '(untitled)'}</strong>
                <small style={{ marginLeft: 8, opacity: 0.7 }}>#{n.id} · {n.created_at}</small>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{n.body}</div>

              <details style={{ marginTop: 8 }}>
                <summary>Edit</summary>
                <form action={`/api/apps/smart-notes/notes/${n.id}/update`} method="post">
                  <div>
                    <label>
                      Title
                      <input name="title" defaultValue={n.title ?? ''} style={{ display: 'block', width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label>
                      Body
                      <textarea name="body" defaultValue={n.body ?? ''} rows={5} style={{ display: 'block', width: '100%' }} />
                    </label>
                  </div>
                  <button type="submit" style={{ marginTop: 8 }}>Save</button>
                </form>
              </details>

              <form action={`/api/apps/smart-notes/notes/${n.id}/delete`} method="post" style={{ marginTop: 8 }}>
                <button type="submit" style={{ color: 'darkred' }}>
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <hr />
      <p style={{ opacity: 0.7 }}>
        Discovered apps: {apps.map((a) => a.id).join(', ')}
      </p>
    </main>
  );
}
