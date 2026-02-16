const APPS = [
  { id: 'smart-notes', name: 'Smart Notes' },
  { id: 'gym-tracker', name: 'Gym Tracker' }
];

export default function HomePage() {
  return (
    <main>
      <h1>Citadel</h1>
      <p>Host is running. Pick an app:</p>
      <ul>
        {APPS.map((a) => (
          <li key={a.id}>
            <a href={`/apps/${a.id}`}>{a.name}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
