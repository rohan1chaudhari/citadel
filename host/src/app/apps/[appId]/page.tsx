import { notFound } from 'next/navigation';

const ALLOWED = new Set(['smart-notes', 'gym-tracker']);

export default async function AppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  if (!ALLOWED.has(appId)) return notFound();

  return (
    <main>
      <h1>App: {appId}</h1>
      <p>
        <a href={`/api/apps/${appId}/health`} target="_blank" rel="noreferrer">
          health
        </a>
        {' | '}
        <a href={`/api/apps/${appId}/selftest`} target="_blank" rel="noreferrer">
          selftest (db + storage)
        </a>
      </p>
      <p>This is a minimal shell to validate isolation + orchestration. UI will come later.</p>
    </main>
  );
}
