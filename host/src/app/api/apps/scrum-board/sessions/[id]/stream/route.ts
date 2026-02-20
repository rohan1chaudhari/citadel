import { NextResponse } from 'next/server';
import { dbQuery, dbExec } from '@/lib/db';
import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'scrum-board';

interface SessionLog {
  id: number;
  session_id: string;
  chunk: string;
  created_at: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - SSE streaming endpoint for session logs
 * Streams log chunks in real-time using Server-Sent Events
 */
export async function GET(_req: Request, { params }: RouteParams) {
  ensureScrumBoardSchema();
  const { id } = await params;
  const sessionId = String(id || '').trim();

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Session ID required' }, { status: 400 });
  }

  // Verify session exists
  const session = dbQuery<{ id: string; status: string }>(
    APP_ID,
    `SELECT id, status FROM sessions WHERE id = ? LIMIT 1`,
    [sessionId]
  )[0];

  if (!session) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  }

  // Set up SSE response
  const encoder = new TextEncoder();
  
  let lastLogId = 0;
  let clientClosed = false;
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMsg = `event: connected\ndata: ${JSON.stringify({ sessionId, status: session.status, ts: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(connectMsg));
      
      // Poll for new logs every 2 seconds
      const interval = setInterval(() => {
        if (clientClosed) {
          clearInterval(interval);
          return;
        }
        
        try {
          // Get new log chunks since last seen
          const logs = dbQuery<SessionLog>(
            APP_ID,
            `SELECT id, chunk, created_at FROM session_logs 
             WHERE session_id = ? AND id > ? 
             ORDER BY id ASC`,
            [sessionId, lastLogId]
          );
          
          for (const log of logs) {
            const event = `event: log\ndata: ${JSON.stringify({ 
              id: log.id, 
              chunk: log.chunk, 
              created_at: log.created_at 
            })}\n\n`;
            controller.enqueue(encoder.encode(event));
            lastLogId = log.id;
          }
          
          // Check if session ended
          const currentSession = dbQuery<{ status: string; ended_at: string | null }>(
            APP_ID,
            `SELECT status, ended_at FROM sessions WHERE id = ? LIMIT 1`,
            [sessionId]
          )[0];
          
          if (currentSession?.ended_at || ['completed', 'failed', 'blocked', 'archived'].includes(currentSession?.status)) {
            const endMsg = `event: ended\ndata: ${JSON.stringify({ 
              status: currentSession?.status, 
              ts: new Date().toISOString() 
            })}\n\n`;
            controller.enqueue(encoder.encode(endMsg));
            clearInterval(interval);
            controller.close();
          }
        } catch (err) {
          const errorMsg = `event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`;
          controller.enqueue(encoder.encode(errorMsg));
        }
      }, 2000);
      
      // Cleanup on client disconnect
      return () => {
        clientClosed = true;
        clearInterval(interval);
      };
    },
    cancel() {
      clientClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering for SSE
    },
  });
}

/**
 * POST - Append log chunks to a session
 * Used by the agent to stream output
 */
export async function POST(req: Request, { params }: RouteParams) {
  ensureScrumBoardSchema();
  const { id } = await params;
  const sessionId = String(id || '').trim();

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Session ID required' }, { status: 400 });
  }

  // Verify session exists
  const session = dbQuery<{ id: string }>(
    APP_ID,
    `SELECT id FROM sessions WHERE id = ? LIMIT 1`,
    [sessionId]
  )[0];

  if (!session) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({} as any));
  const chunk = String(body?.chunk || '');
  
  if (!chunk) {
    return NextResponse.json({ ok: false, error: 'chunk is required' }, { status: 400 });
  }

  // Insert log chunk
  dbExec(
    APP_ID,
    `INSERT INTO session_logs (session_id, chunk, created_at) VALUES (?, ?, ?)`,
    [sessionId, chunk, new Date().toISOString()]
  );

  return NextResponse.json({ ok: true });
}
