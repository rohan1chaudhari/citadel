import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';
import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

type PlanRow = {
  id: number;
  task_id: number;
  title: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export async function GET(req: Request) {
  ensureScrumBoardSchema();
  const url = new URL(req.url);
  const taskId = Number(url.searchParams.get('taskId'));
  
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });
  }

  const plans = dbQuery<PlanRow>(
    APP_ID,
    `SELECT id, task_id, title, content, version, created_at, updated_at 
     FROM plans WHERE task_id = ? ORDER BY version DESC, created_at DESC`,
    [taskId]
  );

  return NextResponse.json({ ok: true, plans });
}

export async function POST(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  
  const taskId = Number(body?.taskId ?? body?.task_id);
  const title = String(body?.title ?? '').trim().slice(0, 200);
  const content = String(body?.content ?? '').trim();
  const exportToKb = Boolean(body?.exportToKb ?? body?.export_to_kb);
  const appId = String(body?.appId ?? body?.app_id ?? '').trim();

  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 });
  }

  // Get next version for this task
  const versionRow = dbQuery<{ maxVersion: number }>(
    APP_ID,
    `SELECT COALESCE(MAX(version), 0) as maxVersion FROM plans WHERE task_id = ?`,
    [taskId]
  )[0];
  const version = (versionRow?.maxVersion ?? 0) + 1;

  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO plans (task_id, title, content, version, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [taskId, title, content, version, now, now]
  );

  const id = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0]?.id;

  // Export to KB if requested
  let exportedPath: string | null = null;
  if (exportToKb && appId) {
    try {
      exportedPath = await exportPlanToKb(appId, taskId, version, title, content);
    } catch (err: any) {
      audit(APP_ID, 'plans.export.error', { taskId, version, error: err?.message });
    }
  }

  audit(APP_ID, 'scrum.plans.create', { taskId, id, version, exported: !!exportedPath });

  return NextResponse.json({ 
    ok: true, 
    id, 
    version,
    exportedPath 
  });
}

async function exportPlanToKb(
  appId: string, 
  taskId: number, 
  version: number, 
  title: string, 
  content: string
): Promise<string> {
  const repoRoot = path.resolve(process.cwd(), '..');
  const kbDir = path.join(repoRoot, 'kb', 'plans', appId);
  
  fs.mkdirSync(kbDir, { recursive: true });
  
  const filename = `task-${taskId}-v${version}.md`;
  const filepath = path.join(kbDir, filename);
  
  const markdown = `# ${title}\n\n**Task ID:** ${taskId}  \n**Version:** ${version}  \n**Exported:** ${new Date().toISOString()}\n\n---\n\n${content}`;
  
  fs.writeFileSync(filepath, markdown, 'utf-8');
  
  return filepath;
}
