async function fetchJson(path: string) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export default async function SmartNotesPage() {
  const data = await fetchJson('http://localhost:3000/api/apps/smart-notes/notes');

  return (
    <main>
      <h1>Smart Notes</h1>

      <form action="/api/apps/smart-notes/notes" method="post">
        <div>
          <label>
            Title
            <input name="title" placeholder="Title" />
          </label>
        </div>
        <div>
          <label>
            Body
            <textarea name="body" placeholder="Write…" rows={4} />
          </label>
        </div>
        <button type="submit">Add note</button>
      </form>

      <h2>Recent</h2>
      <ul>
        {data.notes.map((n: any) => (
          <li key={n.id}>
            <strong>{n.title || '(untitled)'}</strong>
            <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
            <small>{n.created_at}</small>
          </li>
        ))}
      </ul>

      <p>
        <a href="/api/apps/smart-notes/health" target="_blank" rel="noreferrer">health</a>
      </p>
    </main>
  );
}
