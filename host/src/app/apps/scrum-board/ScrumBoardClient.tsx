'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

const STATUS_COLORS: Record<Task['status'], string> = {
  backlog: 'bg-zinc-100',
  todo: 'bg-blue-50',
  in_progress: 'bg-amber-50',
  needs_input: 'bg-purple-50',
  blocked: 'bg-red-50',
  done: 'bg-green-50',
  failed: 'bg-rose-50',
};

function prettyStatus(s: Task['status']) {
  if (s === 'in_progress') return 'In Progress';
  if (s === 'needs_input') return 'Needs Input';
  return s[0].toUpperCase() + s.slice(1);
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function sessionLogUrl(sessionId: string) {
  const sid = String(sessionId || '').trim();
  return `/apps/scrum-master/sessions/${encodeURIComponent(sid)}`;
}

function PriorityBadge({ p }: { p: Task['priority'] }) {
  const colors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-zinc-100 text-zinc-600',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[p]}`}>
      {p}
    </span>
  );
}

export default function ScrumBoardClient({ appIds }: { appIds: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize appId from URL or default to first app
  const urlAppId = searchParams?.get('app');
  const initialAppId = urlAppId && appIds.includes(urlAppId) ? urlAppId : (appIds[0] ?? 'smart-notes');
  
  const [appId, setAppId] = useState(initialAppId);
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

  // Trigger agent state
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  // Live refresh state
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile status filter
  const [mobileFilter, setMobileFilter] = useState<Task['status'] | 'all'>('all');

  async function loadTasks() {
    const res = await fetch(`/api/apps/scrum-board/tasks?app=${encodeURIComponent(appId)}`, { cache: 'no-store' });
    const data = await res.json();
    const nextTasks = (data?.tasks ?? []) as Task[];
    setTasks(nextTasks);
    setLastRefreshAt(new Date());

    if (openTaskId && !nextTasks.some((t) => t.id === openTaskId)) {
      setOpenTaskId(null);
      setComments([]);
    }
  }

  // Auto-poll when there are in_progress tasks
  useEffect(() => {
    const hasInProgress = tasks.some((t) => t.status === 'in_progress');
    setIsLive(hasInProgress);

    if (hasInProgress) {
      // Poll every 3 seconds when there are active sessions
      pollingRef.current = setInterval(() => {
        loadTasks();
      }, 3000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tasks, appId]);

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

  async function triggerAgent() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch('/api/apps/scrum-board/trigger', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appId,
          appName: appId,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Trigger failed');
      setTriggerResult(data.message || 'Triggered');
    } catch (e: any) {
      setTriggerResult(`Error: ${e?.message || 'Unknown'}`);
    } finally {
      setTriggering(false);
    }
  }

  const visibleStatuses = mobileFilter === 'all' ? STATUSES : [mobileFilter];

  return (
    <div className="space-y-4">
      {/* Top controls - stacked on mobile */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:w-auto">
            <Label>Board</Label>
            <select
              value={appId}
              onChange={(e) => {
                const newAppId = e.target.value;
                setAppId(newAppId);
                // Sync to URL
                const params = new URLSearchParams(searchParams?.toString() ?? '');
                params.set('app', newAppId);
                router.replace(`/apps/scrum-board?${params.toString()}`, { scroll: false });
              }}
              className="mt-1 w-full sm:w-64 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {appIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="text-xs text-zinc-500 order-2 sm:order-1">
              {tasks.length} tasks · todo {grouped.todo.length} · in-progress {grouped.in_progress.length}
              {lastRefreshAt && (
                <span className="ml-2 text-zinc-400">
                  · refreshed {lastRefreshAt.toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="flex gap-2 order-1 sm:order-2">
              {isLive && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-amber-50 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-medium text-amber-700">Live</span>
                </div>
              )}
              <Button variant="secondary" onClick={triggerAgent} disabled={triggering} className="flex-1 sm:flex-none">
                {triggering ? '…' : 'Trigger'}
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="flex-1 sm:flex-none">
                + New
              </Button>
            </div>
          </div>
        </div>
        
        {triggerResult && (
          <div className="mt-2 text-xs text-zinc-600">{triggerResult}</div>
        )}
      </Card>

      {/* Mobile filter - only show on small screens */}
      <div className="lg:hidden">
        <Label>Filter status</Label>
        <div className="mt-1 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setMobileFilter('all')}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
              mobileFilter === 'all' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            All ({tasks.length})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setMobileFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                mobileFilter === s ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {prettyStatus(s)} ({grouped[s].length})
            </button>
          ))}
        </div>
      </div>

      {/* Board columns - horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible snap-x snap-mandatory">
        {visibleStatuses.map((s) => (
          <div 
            key={s} 
            className="flex-shrink-0 w-[85vw] sm:w-[300px] lg:w-auto snap-start"
          >
            <Card className={`h-full max-h-[70vh] lg:max-h-[calc(100vh-280px)] flex flex-col ${STATUS_COLORS[s]}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{prettyStatus(s)}</span>
                <span className="text-xs text-zinc-500 bg-white/60 rounded-full px-2 py-0.5">
                  {grouped[s].length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
                    className="w-full cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 text-left hover:border-zinc-400 hover:shadow-sm transition active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 line-clamp-2">{t.title}</div>
                      </div>
                      <PriorityBadge p={t.priority} />
                    </div>
                    
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                      <span>#{t.position}</span>
                      {t.comment_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {t.comment_count}
                        </span>
                      )}
                      {t.claimed_by && t.status === 'in_progress' && (
                        <span className="text-amber-600 flex items-center gap-0.5 font-medium">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          {t.claimed_by}
                          {t.last_run_at && (
                            <span className="text-zinc-400 ml-0.5">· {formatRelativeTime(t.last_run_at)}</span>
                          )}
                        </span>
                      )}
                    </div>
                    
                    {t.session_id ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition ${
                            t.status === 'in_progress'
                              ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(sessionLogUrl(t.session_id as string), '_blank', 'noopener,noreferrer');
                          }}
                        >
                          {t.status === 'in_progress' ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              View session
                              <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View log
                            </>
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                
                {grouped[s].length === 0 && (
                  <div className="text-center py-8 text-xs text-zinc-400">
                    No tasks
                  </div>
                )}
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* Create task modal */}
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6" onClick={() => setCreateOpen(false)}>
          <div 
            className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-4 sm:p-6 shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create task</h3>
              <button 
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 active:bg-zinc-100" 
                onClick={() => setCreateOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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

            <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => setCreateOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  await createTask();
                  setCreateOpen(false);
                }}
                disabled={!title.trim()}
                className="w-full sm:w-auto"
              >
                Create task
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Task modal */}
      {openTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6" onClick={() => setOpenTaskId(null)}>
          <div 
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-4 sm:p-6 shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Task #{openTask.id}</h3>
              <button 
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 active:bg-zinc-100" 
                onClick={() => setOpenTaskId(null)}
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={saveModal}>Save</Button>
              <button className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 active:bg-zinc-100" onClick={() => moveTask(openTask, 'up')}>Move up</button>
              <button className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 active:bg-zinc-100" onClick={() => moveTask(openTask, 'down')}>Move down</button>
            </div>

            {/* Session info */}
            {openTask.session_id && (
              <div className="mt-4 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Session</div>
                    <div className="text-sm font-mono text-zinc-700 truncate max-w-[300px]">{openTask.session_id}</div>
                    {openTask.claimed_by && (
                      <div className="text-xs text-zinc-500 mt-1">
                        Claimed by <span className="font-medium text-amber-600">{openTask.claimed_by}</span>
                        {openTask.claimed_at && (
                          <span> · {formatRelativeTime(openTask.claimed_at)}</span>
                        )}
                      </div>
                    )}
                    {openTask.last_run_at && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Last run {formatRelativeTime(openTask.last_run_at)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition ${
                      openTask.status === 'in_progress'
                        ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                    onClick={() => window.open(sessionLogUrl(openTask.session_id as string), '_blank', 'noopener,noreferrer')}
                  >
                    {openTask.status === 'in_progress' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        View Live
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Log
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <div className="text-sm font-semibold">Comments</div>
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
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
