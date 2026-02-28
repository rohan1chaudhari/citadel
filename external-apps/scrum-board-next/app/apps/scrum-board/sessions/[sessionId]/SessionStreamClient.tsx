'use client';

import { useEffect, useRef, useState } from 'react';

type SessionPayload = {
  ok: boolean;
  session?: {
    id: string;
    status?: string;
    task?: { id: number; title: string } | null;
    app_id?: string | null;
    started_at?: string;
    ended_at?: string | null;
  };
  logs?: Array<{ id: number; chunk: string; created_at: string }>;
};

function proxyBaseFromPathname(pathname: string): string | null {
  const m = pathname.match(/^(.*\/proxy)(?:\/.*)?$/);
  return m?.[1] ?? null;
}

function apiBase(pathname: string) {
  const base = proxyBaseFromPathname(pathname);
  return base ? `${base}/api/scrum-board` : '/api/scrum-board';
}

export default function SessionStreamClient({ sessionId }: { sessionId: string }) {
  const [header, setHeader] = useState<SessionPayload['session'] | null>(null);
  const [status, setStatus] = useState<string>('running');
  const [chunks, setChunks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  const [base, setBase] = useState<string>('/api/scrum-board');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBase(apiBase(window.location.pathname));
    }
  }, []);

  useEffect(() => {
    let closed = false;

    async function boot() {
      try {
        const res = await fetch(`${base}/sessions/${encodeURIComponent(sessionId)}`);
        const data = (await res.json()) as SessionPayload;
        if (!closed && data?.ok) {
          setHeader(data.session ?? null);
          setStatus(data.session?.status ?? 'running');
          setChunks((data.logs ?? []).map((l) => l.chunk));
        }
      } catch (e: any) {
        if (!closed) setError(String(e?.message ?? e));
      }
    }

    boot();

    const es = new EventSource(`${base}/sessions/${encodeURIComponent(sessionId)}/stream`);

    es.addEventListener('log', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data || '{}');
        const chunk = String(data?.chunk ?? '');
        if (!chunk) return;
        setChunks((prev) => [...prev, chunk]);
      } catch {}
    });

    es.addEventListener('ended', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data || '{}');
        setStatus(String(data?.status || 'completed'));
      } catch {
        setStatus('completed');
      }
      es.close();
    });

    es.addEventListener('error', () => {
      setError('Stream disconnected');
    });

    return () => {
      closed = true;
      es.close();
    };
  }, [base, sessionId]);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [chunks]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Agent Session Stream</h1>
      <div style={{ fontSize: 14, opacity: 0.8 }}>
        Session: <code>{sessionId}</code> · Status: <strong>{status}</strong>
        {header?.task?.title ? <> · Task: <strong>{header.task.title}</strong></> : null}
      </div>
      {error ? <div style={{ color: '#b91c1c' }}>{error}</div> : null}
      <pre
        ref={preRef}
        style={{
          margin: 0,
          minHeight: '65vh',
          maxHeight: '70vh',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: 12,
          background: '#0b1020',
          color: '#d1e7ff',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {chunks.join('') || 'Waiting for stream...'}
      </pre>
    </main>
  );
}
