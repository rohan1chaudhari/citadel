'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Label, Textarea } from '@/components/Shell';

type Task = {
  id: number;
  title: string;
  description: string | null;
  acceptance_criteria?: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'needs_input' | 'blocked' | 'done' | 'failed';
  position: number;
  priority: 'low' | 'medium' | 'high';
  assignee: string | null;
  due_at: string | null;
  session_id: string | null;
  attempt_count?: number;
  max_attempts?: number;
  claimed_by?: string | null;
  claimed_at?: string | null;
  last_error?: string | null;
  last_run_at?: string | null;
  needs_input_questions?: string | null;
  input_deadline_at?: string | null;
  comment_count: number;
};

type Comment = { id: number; task_id: number; body: string; created_at: string };

const STATUSES: Task['status'][] = ['backlog', 'todo', 'in_progress', 'needs_input', 'blocked', 'done', 'failed'];
const PRIORITIES: Task['priority'][] = ['high', 'medium', 'low'];

function prettyStatus(s: Task['status']) {
  if (s === 'in_progress') return 'In Progress';
  if (s === 'needs_input') return 'Needs Input';
  return s[0].toUpperCase() + s.slice(1);
}

function sessionLogUrl(sessionId: string) {
  const sid = String(sessionId || '').trim();
  return `/apps/scrum-master/sessions/${encodeURIComponent(sid)}`;
}

export function ScrumBoardClient({ appIds }: { appIds: string[] }) {
  const [appId, setAppId] = useState(appIds[0] ?? 'smart-notes');
  const [tasks, setTasks] = useState<Task[]>([]);

  // Create form (invoked via modal; board selection stays separate)
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [assignee, setAssignee] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [sessionId, setSessionId] = useState('');

  // Modal state
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mDescription, setMDescription] = useState('');
  const [mStatus, setMStatus] = useState<Task['status']>('backlog');
  const [mPriority, setMPriority] = useState<Task['priority']>('medium');
  const [mAssignee, setMAssignee] = useState('');
  const [mDueAt, setMDueAt] = useState('');
  const [mSessionId, setMSessionId] = useState('');
  const [mTargetBoard, setMTargetBoard] = useState('');

  // Comments in modal
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');

  async function loadTasks() {
    const res = await fetch(`/api/apps/scrum-board/tasks?app=${encodeURIComponent(appId)}`, { cache: 'no-store' });
    const data = await res.json();
    const nextTasks = (data?.tasks ?? []) as Task[];
    setTasks(nextTasks);

    if (openTaskId && !nextTasks.some((t) => t.id === openTaskId)) {
      setOpenTaskId(null);
      setComments([]);
    }
  }

  async function loadComments(taskId: number) {
    const res = await fetch(`/api/apps/scrum-board/comments?taskId=${taskId}`, { cache: 'no-store' });
    const data = await res.json();
    setComments((data?.comments ?? []) as Comment[]);
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const grouped = useMemo(() => {
    const g: Record<Task['status'], Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      needs_input: [],
      blocked: [],
      done: [],
      failed: []
    };
    for (const t of tasks) g[t.status].push(t);
    return g;
  }, [tasks]);

  const openTask = useMemo(() => tasks.find((t) => t.id === openTaskId) ?? null, [tasks, openTaskId]);

  async function createTask() {
    const res = await fetch('/api/apps/scrum-board/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        appId,
        title,
        description,
        priority,
        assignee: assignee || null,
        due_at: dueAt || null,
        session_id: sessionId || null,
        status: 'backlog'
      })
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) return;

    setTitle('');
    setDescription('');
    setPriority('medium');
    setAssignee('');
    setDueAt('');
    setSessionId('');
    await loadTasks();
  }

  function openModal(t: Task) {
    setOpenTaskId(t.id);
    setMTitle(t.title ?? '');
    setMDescription(t.description ?? '');
    setMStatus(t.status);
    setMPriority(t.priority);
    setMAssignee(t.assignee ?? '');
    setMDueAt(t.due_at ? new Date(t.due_at).toISOString().slice(0, 16) : '');
    setMSessionId(t.session_id ?? '');
    setMTargetBoard(appId);
    loadComments(t.id);
  }

  async function saveModal() {
    if (!openTaskId) return;
    const res = await fetch('/api/apps/scrum-board/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: openTaskId,
        title: mTitle,
        description: mDescription,
        status: mStatus,
        priority: mPriority,
        assignee: mAssignee || null,
        due_at: mDueAt || null,
        session_id: mSessionId || null,
        targetAppId: mTargetBoard
      })
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) return;

    await loadTasks();
    setOpenTaskId(null);
    setComments([]);
  }

  async function moveTask(t: Task, dir: 'up' | 'down') {
    await fetch('/api/apps/scrum-board/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: t.id, move: dir })
    });
    await loadTasks();
  }

  async function addComment() {
    if (!openTaskId) return;
    const res = await fetch('/api/apps/scrum-board/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: openTaskId, body: commentText })
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) return;
    setCommentText('');
    await loadComments(openTaskId);
    await loadTasks();
  }

  return (
    <div className="space-y-4">
      {/* Top control layer: board selection separate from create form */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Label>Board</Label>
            <select
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {appIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-500">
              {tasks.length} tasks · backlog {grouped.backlog.length} · todo {grouped.todo.length} · in-progress {grouped.in_progress.length} · needs-input {grouped.needs_input.length} · blocked {grouped.blocked.length} · done {grouped.done.length} · failed {grouped.failed.length}
            </div>
            <Button onClick={() => setCreateOpen(true)}>+ New task</Button>
          </div>
        </div>
      </Card>

      {/* Create task is modal-first to keep board view focused */}

      {/* Minimal board cards */}
      <div className="grid gap-3 lg:grid-cols-4">
        {STATUSES.map((s) => (
          <Card key={s} className="space-y-2">
            <div className="text-sm font-semibold">{prettyStatus(s)} <span className="text-zinc-500">({grouped[s].length})</span></div>
            <div className="space-y-2">
              {grouped[s].map((t) => (
                <div
                  key={t.id}
                  onClick={() => openModal(t)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openModal(t);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="w-full cursor-pointer rounded-lg border border-zinc-200 p-2 text-left hover:border-zinc-400"
                >
                  <div className="truncate text-sm font-medium text-zinc-900">{t.title}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    p:{t.priority[0].toUpperCase()} · #{t.position} · c:{t.comment_count}
                  </div>
                  {t.session_id ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(sessionLogUrl(t.session_id as string), '_blank', 'noopener,noreferrer');
                        }}
                      >
                        {t.status === 'in_progress' ? '🔴 Live session' : 'View session log'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Create task modal */}
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={() => setCreateOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Create task</h3>
              <button className="rounded border border-zinc-200 px-2 py-1 text-xs" onClick={() => setCreateOpen(false)}>Close</button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Task description" />
              </div>
              <div>
                <Label>Priority</Label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </div>
              <div>
                <Label>Assignee</Label>
                <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="e.g. rohan" />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              <div>
                <Label>Session ID</Label>
                <Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="execution session id" />
              </div>
            </div>

            <div className="mt-3">
              <Button
                onClick={async () => {
                  await createTask();
                  setCreateOpen(false);
                }}
                disabled={!title.trim()}
              >
                Create task
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Task modal */}
      {openTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={() => setOpenTaskId(null)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Task #{openTask.id}</h3>
              <button className="rounded border border-zinc-200 px-2 py-1 text-xs" onClick={() => setOpenTaskId(null)}>Close</button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Title</Label>
                <Input value={mTitle} onChange={(e) => setMTitle(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea rows={4} value={mDescription} onChange={(e) => setMDescription(e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <select value={mStatus} onChange={(e) => setMStatus(e.target.value as Task['status'])} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                  {STATUSES.map((s) => <option key={s} value={s}>{prettyStatus(s)}</option>)}
                </select>
              </div>
              <div>
                <Label>Priority</Label>
                <select value={mPriority} onChange={(e) => setMPriority(e.target.value as Task['priority'])} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label>Assignee</Label>
                <Input value={mAssignee} onChange={(e) => setMAssignee(e.target.value)} />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="datetime-local" value={mDueAt} onChange={(e) => setMDueAt(e.target.value)} />
              </div>
              <div>
                <Label>Session ID</Label>
                <Input value={mSessionId} onChange={(e) => setMSessionId(e.target.value)} />
              </div>
              <div>
                <Label>Move to board</Label>
                <select value={mTargetBoard} onChange={(e) => setMTargetBoard(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                  {appIds.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={saveModal}>Save</Button>
              <button className="rounded border border-zinc-200 px-2 py-1 text-xs" onClick={() => moveTask(openTask, 'up')}>Move up</button>
              <button className="rounded border border-zinc-200 px-2 py-1 text-xs" onClick={() => moveTask(openTask, 'down')}>Move down</button>
            </div>

            <div className="mt-5 space-y-2">
              <div className="text-sm font-semibold">Comments</div>
              {comments.map((c) => (
                <div key={c.id} className="rounded border border-zinc-200 p-2 text-sm">
                  <div className="whitespace-pre-wrap">{c.body}</div>
                  <div className="mt-1 text-xs text-zinc-500">{c.created_at}</div>
                </div>
              ))}
              {comments.length === 0 ? <p className="text-sm text-zinc-500">No comments yet.</p> : null}
              <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3} placeholder="Add comment" />
              <div>
                <Button onClick={addComment} disabled={!commentText.trim()}>Add comment</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
