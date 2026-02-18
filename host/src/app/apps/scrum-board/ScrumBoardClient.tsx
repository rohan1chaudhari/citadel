'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Label, Textarea } from '@/components/Shell';

type Task = {
  id: number;
  title: string;
  description: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee: string | null;
  due_at: string | null;
  session_id: string | null;
  comment_count: number;
};

type Comment = { id: number; task_id: number; body: string; created_at: string };

const STATUSES: Task['status'][] = ['backlog', 'todo', 'in_progress', 'done'];
const PRIORITIES: Task['priority'][] = ['high', 'medium', 'low'];

function prettyStatus(s: Task['status']) {
  return s === 'in_progress' ? 'In Progress' : s[0].toUpperCase() + s.slice(1);
}

export function ScrumBoardClient({ appIds }: { appIds: string[] }) {
  const [appId, setAppId] = useState(appIds[0] ?? 'smart-notes');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [assignee, setAssignee] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');

  async function loadTasks() {
    const res = await fetch(`/api/apps/scrum-board/tasks?app=${encodeURIComponent(appId)}`, { cache: 'no-store' });
    const data = await res.json();
    setTasks((data?.tasks ?? []) as Task[]);
    if (selectedTask && !(data?.tasks ?? []).some((t: Task) => t.id === selectedTask)) {
      setSelectedTask(null);
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

  useEffect(() => {
    if (selectedTask) loadComments(selectedTask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask]);

  const grouped = useMemo(() => {
    const g: Record<Task['status'], Task[]> = { backlog: [], todo: [], in_progress: [], done: [] };
    for (const t of tasks) g[t.status].push(t);
    return g;
  }, [tasks]);

  async function createTask() {
    const res = await fetch('/api/apps/scrum-board/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appId, title, description, priority, assignee: assignee || null, due_at: dueAt || null, session_id: sessionId || null, status: 'backlog' })
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) return;
    setTitle('');
    setDescription('');
    setAssignee('');
    setDueAt('');
    setSessionId('');
    setPriority('medium');
    await loadTasks();
  }

  async function quickMove(t: Task, status: Task['status']) {
    await fetch('/api/apps/scrum-board/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: t.id, status })
    });
    await loadTasks();
  }

  async function changePriority(t: Task, p: Task['priority']) {
    await fetch('/api/apps/scrum-board/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: t.id, priority: p })
    });
    await loadTasks();
  }

  async function changeAssignee(t: Task, who: string) {
    await fetch('/api/apps/scrum-board/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: t.id, assignee: who || null })
    });
    await loadTasks();
  }

  async function changeDueAt(t: Task, dueAtValue: string) {
    await fetch('/api/apps/scrum-board/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: t.id, due_at: dueAtValue || null })
    });
    await loadTasks();
  }

  async function addComment() {
    if (!selectedTask) return;
    const res = await fetch('/api/apps/scrum-board/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: selectedTask, body: commentText })
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) return;
    setCommentText('');
    await loadComments(selectedTask);
    await loadTasks();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Board app</Label>
            <select
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {appIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Priority (Step 1)</Label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Task description" />
          </div>
          <div>
            <Label>Assignee (Step 2)</Label>
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="e.g. rohan" />
          </div>
          <div>
            <Label>Due date (Step 3)</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div>
            <Label>Session ID (optional)</Label>
            <Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="session id for execution context/output" />
          </div>
        </div>
        <div className="mt-3">
          <Button onClick={createTask} disabled={!title.trim()}>Create task</Button>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-4">
        {STATUSES.map((s) => (
          <Card key={s} className="space-y-2">
            <div className="text-sm font-semibold">{prettyStatus(s)} <span className="text-zinc-500">({grouped[s].length})</span></div>
            <div className="space-y-2">
              {grouped[s].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTask(t.id)}
                  className={`w-full rounded-lg border p-2 text-left text-sm ${selectedTask === t.id ? 'border-zinc-900' : 'border-zinc-200'}`}
                >
                  <div className="font-medium text-zinc-900">{t.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">priority: {t.priority} · comments: {t.comment_count}</div>
                  <div className="mt-1 text-xs text-zinc-500">assignee: {t.assignee || 'unassigned'}</div>
                  {t.due_at ? <div className="mt-1 text-xs text-zinc-500">due: {new Date(t.due_at).toLocaleString()}</div> : null}
                  {t.session_id ? <div className="mt-1 text-xs text-zinc-500">session: {t.session_id}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {STATUSES.filter((x) => x !== t.status).map((x) => (
                      <button
                        key={x}
                        className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          quickMove(t, x);
                        }}
                      >
                        {prettyStatus(x)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        className={`rounded border px-1.5 py-0.5 text-xs ${t.priority === p ? 'border-zinc-900' : 'border-zinc-200'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          changePriority(t, p);
                        }}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        const who = window.prompt('Assignee (blank to unassign)', t.assignee ?? '');
                        if (who !== null) changeAssignee(t, who.trim());
                      }}
                    >
                      assign
                    </button>
                    <button
                      className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = t.due_at ? new Date(t.due_at).toISOString().slice(0, 16) : '';
                        const next = window.prompt('Due date (YYYY-MM-DDTHH:mm, blank to clear)', current);
                        if (next !== null) changeDueAt(t, next.trim());
                      }}
                    >
                      due
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="text-sm font-semibold">Comments {selectedTask ? `(task #${selectedTask})` : ''}</div>
        {!selectedTask ? <p className="mt-2 text-sm text-zinc-500">Select a task to view comments.</p> : null}
        {selectedTask ? (
          <>
            <div className="mt-2 space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded border border-zinc-200 p-2 text-sm">
                  <div className="text-zinc-900 whitespace-pre-wrap">{c.body}</div>
                  <div className="mt-1 text-xs text-zinc-500">{c.created_at}</div>
                </div>
              ))}
              {comments.length === 0 ? <p className="text-sm text-zinc-500">No comments yet.</p> : null}
            </div>
            <div className="mt-3 grid gap-2">
              <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3} placeholder="Add comment" />
              <div>
                <Button onClick={addComment} disabled={!commentText.trim()}>Add comment</Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
