type Entry = { id: number; date: string; exercise: string; sets: number | null; reps: number | null; weight: number | null; created_at: string };

async function fetchEntries() {
  const res = await fetch('http://localhost:3000/api/apps/gym-tracker/entries', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as { ok: true; entries: Entry[] };
}

export default async function GymTrackerPage() {
  const data = await fetchEntries();

  return (
    <main>
      <p>
        <a href="/">← home</a>
      </p>
      <h1>Gym Tracker</h1>
      <p style={{ opacity: 0.7 }}>MVP: minimal logging (DB + storage interaction)</p>

      <section style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <h2>New entry</h2>
        <form action="/api/apps/gym-tracker/entries" method="post">
          <div>
            <label>
              Date
              <input name="date" type="date" />
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>
              Exercise
              <input name="exercise" placeholder="Bench press" style={{ display: 'block', width: '100%' }} />
            </label>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <label>
              Sets
              <input name="sets" type="number" min="0" step="1" />
            </label>
            <label>
              Reps
              <input name="reps" type="number" min="0" step="1" />
            </label>
            <label>
              Weight
              <input name="weight" type="number" min="0" step="0.5" />
            </label>
          </div>
          <button type="submit" style={{ marginTop: 8 }}>Add</button>
        </form>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Recent</h2>
        <ul style={{ paddingLeft: 18 }}>
          {data.entries.map((e) => (
            <li key={e.id} style={{ marginBottom: 10 }}>
              <strong>{e.exercise}</strong> — {e.date || '(no date)'}
              <div style={{ opacity: 0.8 }}>
                sets: {e.sets ?? '-'} · reps: {e.reps ?? '-'} · weight: {e.weight ?? '-'}
              </div>
              <small style={{ opacity: 0.7 }}>#{e.id} · {e.created_at}</small>
            </li>
          ))}
        </ul>
      </section>

      <p>
        <a href="/api/apps/gym-tracker/health" target="_blank" rel="noreferrer">health</a>
      </p>
    </main>
  );
}
