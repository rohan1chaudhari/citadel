import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { ensureScrumBoardSchema, getSession, updateSessionStatus, getSessionsForTask, createSession } from '@/lib/scrumBoardSchema';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(req: Request) {
  ensureScrumBoardSchema();
  const taskId = Number(new URL(req.url).searchParams.get('taskId'));
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });

  const comments = dbQuery(
    APP_ID,
    `SELECT id, task_id, body, created_at FROM comments WHERE task_id = ? ORDER BY id ASC`,
    [taskId]
  );

  return NextResponse.json({ ok: true, comments });
}

export async function POST(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  const taskId = Number(body?.taskId);
  const text = String(body?.body ?? '').trim().slice(0, 4000);
  const isUserAnswer = Boolean(body?.isUserAnswer ?? true); // Default true for UI comments
  
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });
  if (!text) return NextResponse.json({ ok: false, error: 'body required' }, { status: 400 });

  const now = new Date().toISOString();
  
  // Insert the comment
  dbExec(APP_ID, `INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, ?)`, [taskId, text, now]);

  // Auto-resume: Check if task is waiting and has a session_id - trigger wake
  const task = dbQuery<{
    id: number;
    status: string;
    session_id: string | null;
    board_id: number;
    title: string;
  }>(
    APP_ID,
    `SELECT t.id, t.status, t.session_id, t.board_id, t.title 
     FROM tasks t 
     WHERE t.id = ? LIMIT 1`,
    [taskId]
  )[0];

  let wakeResult: { ok: boolean; message: string; sessionId?: string; resumed?: boolean; newSession?: boolean } | null = null;

  // Auto-resume: if task is waiting and has a session_id, wake it up
  if (task?.session_id && task.status === 'waiting') {
    // Try to wake/resume the session
    wakeResult = await wakeSession(task.session_id, taskId, text, task.title);
    
    // If wake succeeded, update task status back to in_progress
    if (wakeResult?.ok) {
      dbExec(
        APP_ID,
        `UPDATE tasks SET status = 'in_progress', last_run_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, taskId]
      );
      
      // Add system comment about the resume
      const resumeMsg = wakeResult.resumed 
        ? `[AUTOPILOT_RESUME] Session resumed with user answer`
        : `[AUTOPILOT_RESUME] New session started with full context (previous session expired)`;
      dbExec(APP_ID, `INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, ?)`, [taskId, resumeMsg, now]);
    }
  }

  return NextResponse.json({ ok: true, wakeResult });
}

async function wakeSession(
  sessionId: string, 
  taskId: number, 
  userAnswer: string,
  taskTitle: string
): Promise<{ ok: boolean; message: string; sessionId: string; resumed: boolean; newSession: boolean }> {
  const now = new Date();
  
  // Check if original session exists and get its info
  const session = getSession(sessionId);
  const sessionsForTask = getSessionsForTask(taskId);
  
  // Find the most recent session for this task
  const latestSession = sessionsForTask[0];
  
  // Check if session is expired (>30 min since last activity)
  let isExpired = true;
  let targetSessionId = sessionId;
  
  if (latestSession?.started_at) {
    const sessionStart = new Date(latestSession.started_at).getTime();
    const elapsedMs = now.getTime() - sessionStart;
    isExpired = elapsedMs > SESSION_EXPIRY_MS;
  }

  if (isExpired) {
    // Session expired - create new session with full context
    const newSessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createSession(newSessionId, taskId, 'WAKE-RESUME');
    targetSessionId = newSessionId;
    
    // Get all comments for context
    const comments = dbQuery<{ body: string; created_at: string }>(
      APP_ID,
      `SELECT body, created_at FROM comments WHERE task_id = ? ORDER BY created_at ASC`,
      [taskId]
    );
    
    const contextMessage = buildContextMessage(taskTitle, comments, userAnswer);
    
    // Send to new session via sessions_spawn
    try {
      await sendToNewSession(targetSessionId, contextMessage);
      return {
        ok: true,
        message: 'New session started with full context (previous session expired)',
        sessionId: targetSessionId,
        resumed: false,
        newSession: true
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `Failed to start new session: ${err?.message || 'Unknown error'}`,
        sessionId: targetSessionId,
        resumed: false,
        newSession: true
      };
    }
  } else {
    // Session not expired - wake existing session via sessions_send
    try {
      await sendToExistingSession(targetSessionId, userAnswer);
      
      // Update session status back to running if it was waiting
      if (session?.status === 'waiting') {
        updateSessionStatus(targetSessionId, 'running');
      }
      
      return {
        ok: true,
        message: 'Session resumed with user answer',
        sessionId: targetSessionId,
        resumed: true,
        newSession: false
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `Failed to resume session: ${err?.message || 'Unknown error'}`,
        sessionId: targetSessionId,
        resumed: false,
        newSession: false
      };
    }
  }
}

function buildContextMessage(
  taskTitle: string,
  comments: { body: string; created_at: string }[],
  userAnswer: string
): string {
  const conversationHistory = comments
    .filter(c => !c.body.startsWith('[AUTOPILOT'))
    .map(c => `[${new Date(c.created_at).toISOString()}] ${c.body}`)
    .join('\n\n');
  
  return `Resuming task: "${taskTitle}"

Previous conversation history:
${conversationHistory || '(No previous comments)'}

---

NEW USER ANSWER:
${userAnswer}

---

The task was previously blocked/awaiting input. Please continue from where you left off, incorporating the user's answer above. Review the conversation history for context.`;
}

async function sendToExistingSession(sessionId: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      'sessions', 'send',
      '--session', sessionId,
      '--message', message,
    ];

    const child = spawn('openclaw', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (d) => (stderr += d));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `sessions send exited ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function sendToNewSession(sessionId: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      'sessions', 'spawn',
      '--label', sessionId,
      '--message', message,
      '--model', 'default',
      '--timeout-seconds', '600',
    ];

    const child = spawn('openclaw', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (d) => (stderr += d));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `sessions spawn exited ${code}`));
      } else {
        resolve();
      }
    });
  });
}
