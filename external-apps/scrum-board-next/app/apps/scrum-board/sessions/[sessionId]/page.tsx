import SessionStreamClient from './SessionStreamClient';

export const runtime = 'nodejs';

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <SessionStreamClient sessionId={sessionId} />;
}
