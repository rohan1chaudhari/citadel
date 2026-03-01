import { NextResponse } from 'next/server';
import { dbExec } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'task-manager';

// POST /api/apps/task-manager/tasks/create
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  
  const title = String(body?.title ?? '').trim();
  const description = body?.description ? String(body.description).trim() : null;
  const priority = ['low', 'medium', 'high'].includes(body?.priority) 
    ? body.priority 
    : 'medium';

  if (!title) {
    return NextResponse.json(
      { ok: false, error: 'Title is required' }, 
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  
  const result = dbExec(
    APP_ID,
    `INSERT INTO tasks (title, description, priority, status, created_at) 
     VALUES (?, ?, ?, ?, ?)`,
    [title, description, priority, 'active', now]
  );

  return NextResponse.json({
    ok: true,
    id: result.lastInsertRowid,
    task: { 
      id: result.lastInsertRowid, 
      title, 
      description, 
      priority, 
      status: 'active', 
      created_at: now, 
      updated_at: null,
      completed_at: null
    }
  });
}
