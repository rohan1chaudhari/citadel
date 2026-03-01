import { NextRequest, NextResponse } from 'next/server';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const DATA_ROOT = process.env.CITADEL_DATA_ROOT ?? path.join(process.cwd(), '..', 'data');
const CITADEL_DB_PATH = path.join(DATA_ROOT, 'apps', 'citadel', 'db.sqlite');

function getCitadelDb(): DatabaseSync {
  fs.mkdirSync(path.dirname(CITADEL_DB_PATH), { recursive: true });
  const db = new DatabaseSync(CITADEL_DB_PATH);
  return db;
}

interface AuditLogEntry {
  id: number;
  ts: string;
  app_id: string;
  event: string;
  payload: string;
  created_at: string;
}

interface QueryResult {
  results: AuditLogEntry[];
  total: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Pagination params
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const offset = (page - 1) * limit;
  
  // Filter params
  const appId = searchParams.get('app_id');
  const event = searchParams.get('event');
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  
  try {
    const db = getCitadelDb();
    
    // Build WHERE clause
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];
    
    if (appId && appId !== 'all') {
      whereClauses.push('app_id = ?');
      params.push(appId);
    }
    
    if (event && event !== 'all') {
      whereClauses.push('event = ?');
      params.push(event);
    }
    
    if (fromDate) {
      whereClauses.push('ts >= ?');
      params.push(fromDate);
    }
    
    if (toDate) {
      whereClauses.push('ts <= ?');
      params.push(toDate + 'T23:59:59.999Z');
    }
    
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM audit_log ${whereSql}`);
    const countResult = countStmt.get(...params) as unknown as { total: number };
    const total = countResult?.total ?? 0;
    
    // Get paginated results
    const queryParams = [...params, limit, offset];
    const stmt = db.prepare(`
      SELECT id, ts, app_id, event, payload, created_at
      FROM audit_log
      ${whereSql}
      ORDER BY ts DESC
      LIMIT ? OFFSET ?
    `);
    const results = stmt.all(...queryParams) as unknown as AuditLogEntry[];
    
    // Parse JSON payloads
    const entries = results.map(row => ({
      ...row,
      payload: parsePayload(row.payload),
    }));
    
    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

function parsePayload(payload: string): Record<string, unknown> {
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return { raw: payload };
  }
}
