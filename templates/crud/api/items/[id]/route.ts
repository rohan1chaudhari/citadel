import { NextResponse } from 'next/server';
import { dbQuery } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

// GET /api/apps/{{app_id}}/items/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = dbQuery<{
    id: number;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string | null;
  }>(
    APP_ID,
    'SELECT id, title, description, status, created_at, updated_at FROM items WHERE id = ?',
    [id]
  );

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: items[0] });
}
