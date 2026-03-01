import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'task-manager';

// GET /api/apps/task-manager/tasks/123
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const task = dbQuery<{
    id: number;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string | null;
    completed_at: string | null;
  }>(
    APP_ID,
    'SELECT * FROM tasks WHERE id = ?',
    [id]
  )[0];

  if (!task) {
    return NextResponse.json(
      { ok: false, error: 'Task not found' }, 
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, task });
}

// PUT /api/apps/task-manager/tasks/123
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  
  const title = String(body?.title ?? '').trim();
  const description = body?.description !== undefined 
    ? String(body.description).trim() || null 
    : null;
  const priority = ['low', 'medium', 'high'].includes(body?.priority) 
    ? body.priority 
    : null;
  const status = body?.status === 'completed' || body?.status === 'active'
    ? body.status 
    : null;

  if (!title) {
    return NextResponse.json(
      { ok: false, error: 'Title is required' }, 
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const completedAt = status === 'completed' ? now : null;

  dbExec(
    APP_ID,
    `UPDATE tasks 
     SET title = ?, description = ?, priority = COALESCE(?, priority), 
         status = COALESCE(?, status), updated_at = ?, completed_at = COALESCE(?, completed_at)
     WHERE id = ?`,
    [title, description, priority, status, now, completedAt, id]
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/apps/task-manager/tasks/123
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  dbExec(APP_ID, 'DELETE FROM tasks WHERE id = ?', [id]);
  
  return NextResponse.json({ ok: true });
}
