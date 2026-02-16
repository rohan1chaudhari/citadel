export default function GymTrackerPage() {
  return (
    <main>
      <h1>Gym Tracker (minimal)</h1>
      <p>This exists to validate DB + storage isolation.</p>
      <p>
        <a href="/api/apps/gym-tracker/ping" target="_blank" rel="noreferrer">
          Run ping (db + storage)
        </a>
      </p>
      <p>
        <a href="/api/apps/gym-tracker/health" target="_blank" rel="noreferrer">health</a>
      </p>
    </main>
  );
}
