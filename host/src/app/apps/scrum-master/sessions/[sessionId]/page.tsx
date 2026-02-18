import { Card, Shell } from '@/components/Shell';
import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
import { dbQuery } from '@/lib/db';

export const runtime = 'nodejs';

type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  session_id: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
};

type CommentRow = {
  id: number;
  task_id: number;
  body: string;
  created_at: string;
};

function fmt(ts?: string | null) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

export default async function ScrumMasterSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const sid = decodeURIComponent(sessionId || '').trim();

  ensureScrumBoardSchema();

  const tasks = dbQuery<TaskRow>(
    'scrum-board',
    `SELECT id, title, description, status, priority, session_id, created_at, updated_at, completed_at
     FROM tasks
     WHERE session_id = ?
     ORDER BY id DESC`,
    [sid]
  ).map((t) => ({ ...t }));

  const comments = tasks.length
    ? dbQuery<CommentRow>(
        'scrum-board',
        `SELECT id, task_id, body, created_at
         FROM comments
         WHERE task_id IN (${tasks.map(() => '?').join(',')})
         ORDER BY id ASC`,
        tasks.map((t) => t.id)
      ).map((c) => ({ ...c }))
    : [];

  const commentsByTask = new Map<number, CommentRow[]>();
  for (const c of comments) {
    if (!commentsByTask.has(c.task_id)) commentsByTask.set(c.task_id, []);
    commentsByTask.get(c.task_id)!.push(c);
  }

  return (
    <Shell
      title="Scrum Master · Session Log"
      subtitle={`Session: ${sid}`}
    >
      {tasks.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600">No scrum-board tasks found for this session id.</p>
          <p className="mt-2 text-xs text-zinc-500">
            Tip: session logs are linked when a task has a `session_id` set.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tasks.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">#{t.id} · {t.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    status: {t.status} · priority: {t.priority}
                  </div>
                </div>
                <div className="text-xs text-zinc-500 text-right">
                  <div>created: {fmt(t.created_at)}</div>
                  <div>updated: {fmt(t.updated_at)}</div>
                  <div>completed: {fmt(t.completed_at)}</div>
                </div>
              </div>

              {t.description ? (
                <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-2 text-sm whitespace-pre-wrap">
                  {t.description}
                </div>
              ) : null}

              <div className="mt-3">
                <div className="text-xs font-semibold text-zinc-700">Comments</div>
                <div className="mt-2 grid gap-2">
                  {(commentsByTask.get(t.id) ?? []).length === 0 ? (
                    <div className="text-sm text-zinc-500">No comments.</div>
                  ) : (
                    (commentsByTask.get(t.id) ?? []).map((c) => (
                      <div key={c.id} className="rounded border border-zinc-200 p-2">
                        <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                        <div className="mt-1 text-xs text-zinc-500">{fmt(c.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}
