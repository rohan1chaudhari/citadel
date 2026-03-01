import { NextResponse } from 'next/server';
import { dbQuery } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'task-manager';

// GET /api/apps/task-manager/tasks
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  
  let sql = `
    SELECT id, title, description, priority, status, 
           created_at, updated_at, completed_at 
    FROM tasks 
    WHERE 1=1
  `;
  const params: (string | null)[] = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ` ORDER BY 
    CASE priority 
      WHEN "high" THEN 1 
      WHEN "medium" THEN 2 
      ELSE 3 
    END, 
    created_at DESC 
    LIMIT 500`;
  
  const tasks = dbQuery<{
    id: number;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string | null;
    completed_at: string | null;
  }>(APP_ID, sql, params);

  return NextResponse.json({ ok: true, tasks });
}
