'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Card, Input, Label, Textarea } from '@/components/Shell';
import { getExternalProject } from '@/lib/externalProjects';

type Task = {
  id: number;
  title: string;
  description: string | null;
  acceptance_criteria?: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'validating' | 'needs_input' | 'blocked' | 'done' | 'failed';
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
  validation_rounds?: number;
};

type Comment = { id: number; task_id: number; body: string; created_at: string };

type Plan = { 
  id: number; 
  task_id: number; 
  title: string; 
  content: string; 
  version: number; 
  created_at: string; 
  updated_at: string;
};

type InputQuestion = {
  id: string;
  question: string;
  options?: string[];
  asked_at: string;
  answered: boolean;
  answer?: string;
};

type InboxTask = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high';
  needs_input_questions: string | null;
  input_deadline_at: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string | null;
  board_app_id: string;
  questions: InputQuestion[];
  questionCount: number;
};

const STATUSES: Task['status'][] = ['backlog', 'todo', 'in_progress', 'validating', 'needs_input', 'blocked', 'done', 'failed'];
const PRIORITIES: Task['priority'][] = ['high', 'medium', 'low'];

const STATUS_COLORS: Record<Task['status'], string> = {
  backlog: 'bg-zinc-100',
  todo: 'bg-blue-50',
  in_progress: 'bg-amber-50',
  validating: 'bg-indigo-50',
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

export default function ScrumBoardClient({ appIds, externalIds = [] }: { appIds: string[]; externalIds?: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Combine all board IDs (apps + external projects)
  const allBoardIds = useMemo(() => [...appIds, ...externalIds], [appIds, externalIds]);
  
  // Check if current board is external
  const isExternal = (id: string) => externalIds.includes(id);
  
  // Initialize appId from URL or default to first app
  const urlAppId = searchParams?.get('app');
  const initialAppId = urlAppId && allBoardIds.includes(urlAppId) ? urlAppId : (allBoardIds[0] ?? 'smart-notes');
  
  const [appId, setAppId] = useState(initialAppId);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Create form (invoked via modal; board selection stays separate)
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [assignee, setAssignee] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [triggerImmediately, setTriggerImmediately] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ triggered?: boolean; message?: string } | null>(null);

  // Modal state
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mDescription, setMDescription] = useState('');
  const [mAcceptanceCriteria, setMAcceptanceCriteria] = useState('');
  const [mStatus, setMStatus] = useState<Task['status']>('backlog');
  const [mPriority, setMPriority] = useState<Task['priority']>('medium');
  const [mAssignee, setMAssignee] = useState('');
  const [mDueAt, setMDueAt] = useState('');
  const [mSessionId, setMSessionId] = useState('');
  const [mTargetBoard, setMTargetBoard] = useState('');

  // Comments in modal
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');

  // Plans in modal
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planContent, setPlanContent] = useState('');
  const [planExportToKb, setPlanExportToKb] = useState(true);
  const [planCreating, setPlanCreating] = useState(false);

  // Trigger agent state
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  // Live refresh state
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Autopilot toggle state
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(true);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Validation action state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<string | null>(null);

  // Mobile status filter
  const [mobileFilter, setMobileFilter] = useState<Task['status'] | 'all'>('all');

  // Agent lock state
  const [agentLock, setAgentLock] = useState<{ locked: boolean; taskId?: number; sessionId?: string } | null>(null);

  // Inbox state
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTasks, setInboxTasks] = useState<InboxTask[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

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

  async function loadSettings() {
    const res = await fetch('/api/apps/scrum-board/settings', { cache: 'no-store' });
    const data = await res.json();
    if (data?.ok && data?.settings) {
      setAutopilotEnabled(data.settings.autopilot_enabled ?? true);
    }
  }

  async function loadAgentLock() {
    const res = await fetch('/api/apps/scrum-board/lock', { cache: 'no-store' });
    const data = await res.json();
    if (data?.ok) {
      setAgentLock({
        locked: data.locked,
        taskId: data.lock?.task_id,
        sessionId: data.lock?.session_id,
      });
    }
  }

  async function loadInbox() {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const res = await fetch('/api/apps/scrum-board/request-input', { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok) {
        setInboxTasks(data.tasks || []);
      } else {
        setInboxError(data?.error || 'Failed to load inbox');
      }
    } catch (err: any) {
      setInboxError(err?.message || 'Failed to load inbox');
    } finally {
      setInboxLoading(false);
    }
  }

  function openInbox() {
    setInboxOpen(true);
    loadInbox();
  }

  function openTaskFromInbox(taskId: number) {
    setInboxOpen(false);
    const task = inboxTasks.find(t => t.id === taskId);
    if (task) {
      // Switch to the task's board first
      if (allBoardIds.includes(task.board_app_id)) {
        setAppId(task.board_app_id);
      }
      // Then open the task modal
      setTimeout(() => {
        const fullTask: Task = {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status as Task['status'],
          position: 0,
          priority: task.priority,
          assignee: null,
          due_at: null,
          session_id: task.session_id,
          attempt_count: 0,
          max_attempts: 3,
          claimed_by: null,
          claimed_at: null,
          last_error: null,
          last_run_at: null,
          needs_input_questions: task.needs_input_questions,
          input_deadline_at: task.input_deadline_at,
          comment_count: 0,
          validation_rounds: 0,
        };
        openModal(fullTask);
      }, 100);
    }
  }

  async function toggleAutopilot(enabled: boolean) {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/apps/scrum-board/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ autopilot_enabled: enabled }),
      });
      const data = await res.json();
      if (data?.ok && data?.settings) {
        setAutopilotEnabled(data.settings.autopilot_enabled ?? true);
      }
    } finally {
      setSettingsLoading(false);
    }
  }

  // Auto-poll when there are in_progress or validating tasks
  useEffect(() => {
    const hasActiveSession = tasks.some((t) => t.status === 'in_progress' || t.status === 'validating');
    setIsLive(hasActiveSession);

    if (hasActiveSession) {
      // Poll every 3 seconds when there are active sessions
      pollingRef.current = setInterval(() => {
        loadTasks();
        loadAgentLock();
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

  async function loadPlans(taskId: number) {
    setPlansLoading(true);
    try {
      const res = await fetch(`/api/apps/scrum-board/plans?taskId=${taskId}`, { cache: 'no-store' });
      const data = await res.json();
      setPlans((data?.plans ?? []) as Plan[]);
    } finally {
      setPlansLoading(false);
    }
  }

  async function createPlan() {
    if (!openTaskId || !planTitle.trim()) return;
    setPlanCreating(true);
    try {
      const res = await fetch('/api/apps/scrum-board/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taskId: openTaskId,
          title: planTitle,
          content: planContent,
          exportToKb: planExportToKb,
          appId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) return;
      
      // Clear form and reload plans
      setPlanTitle('');
      setPlanContent('');
      await loadPlans(openTaskId);
    } finally {
      setPlanCreating(false);
    }
  }

  useEffect(() => {
    loadTasks();
    loadSettings();
    loadAgentLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const grouped = useMemo(() => {
    const g: Record<Task['status'], Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      validating: [],
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
    setCreateLoading(true);
    setCreateResult(null);
    try {
      const res = await fetch('/api/apps/scrum-board/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appId,
          title,
          description,
          acceptance_criteria: acceptanceCriteria || null,
          priority,
          assignee: assignee || null,
          due_at: dueAt || null,
          session_id: sessionId || null,
          status: 'backlog',
          trigger_immediately: triggerImmediately,
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setCreateResult({ message: data?.error || 'Failed to create task' });
        return;
      }

      // Show trigger result if immediate trigger was requested
      if (triggerImmediately) {
        if (data.triggered) {
          setCreateResult({ 
            triggered: true, 
            message: `Task created and autopilot triggered! (${data.triggerResult?.eligibleCount || 1} eligible task${data.triggerResult?.eligibleCount === 1 ? '' : 's'})` 
          });
        } else {
          setCreateResult({ 
            triggered: false, 
            message: `Task created but trigger failed: ${data.triggerError || 'Unknown error'}` 
          });
        }
        // Keep modal open briefly to show result, then clear and close
        setTimeout(() => {
          resetCreateForm();
          setCreateOpen(false);
        }, 2000);
      } else {
        resetCreateForm();
        setCreateOpen(false);
      }

      await loadTasks();
    } finally {
      setCreateLoading(false);
    }
  }

  function resetCreateForm() {
    setTitle('');
    setDescription('');
    setAcceptanceCriteria('');
    setPriority('medium');
    setAssignee('');
    setDueAt('');
    setSessionId('');
    setTriggerImmediately(false);
    setCreateResult(null);
  }

  function openModal(t: Task) {
    setOpenTaskId(t.id);
    setMTitle(t.title ?? '');
    setMDescription(t.description ?? '');
    setMAcceptanceCriteria(t.acceptance_criteria ?? '');
    setMStatus(t.status);
    setMPriority(t.priority);
    setMAssignee(t.assignee ?? '');
    setMDueAt(t.due_at ? new Date(t.due_at).toISOString().slice(0, 16) : '');
    setMSessionId(t.session_id ?? '');
    setMTargetBoard(appId);
    loadComments(t.id);
    loadPlans(t.id);
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
        acceptance_criteria: mAcceptanceCriteria || null,
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
    
    // Show wake result if session was resumed
    if (data.wakeResult?.ok) {
      setValidationResult(data.wakeResult.message);
    }
  }

  async function resumeBlockedTask() {
    if (!openTaskId || !openTask) return;
    setValidating(true);
    setValidationResult(null);
    try {
      // Add a system comment to trigger wake
      const res = await fetch('/api/apps/scrum-board/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          taskId: openTaskId, 
          body: '[USER_RESUME] User manually requested to resume this blocked task',
          isUserAnswer: true
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setValidationResult(`Error: ${data?.error || 'Failed to resume'}`);
        return;
      }
      
      if (data.wakeResult?.ok) {
        setValidationResult(data.wakeResult.message);
        await loadTasks();
      } else {
        setValidationResult(`Resume failed: ${data.wakeResult?.message || 'Unknown error'}`);
      }
    } finally {
      setValidating(false);
    }
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

  // Validation actions for tasks in 'validating' status
  async function approveTask() {
    if (!openTaskId) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch('/api/apps/scrum-board/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: openTaskId,
          status: 'done',
          comment: '[AUTOPILOT_VALIDATION] Approved by human review'
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setValidationResult(`Error: ${data?.error || 'Failed to approve'}`);
        return;
      }
      setValidationResult('Task approved and moved to done!');
      await loadTasks();
      setOpenTaskId(null);
    } finally {
      setValidating(false);
    }
  }

  async function rejectTask() {
    if (!openTaskId) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch('/api/apps/scrum-board/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: openTaskId,
          status: 'in_progress',
          comment: '[AUTOPILOT_VALIDATION] Rejected - returned to in_progress for more work'
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setValidationResult(`Error: ${data?.error || 'Failed to reject'}`);
        return;
      }
      setValidationResult('Task rejected and returned to in_progress!');
      await loadTasks();
      setOpenTaskId(null);
    } finally {
      setValidating(false);
    }
  }

  async function needsChangesTask() {
    if (!openTaskId) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch('/api/apps/scrum-board/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: openTaskId,
          status: 'validating',
          validation_rounds: (openTask?.validation_rounds ?? 0) + 1,
          comment: '[AUTOPILOT_VALIDATION] Needs changes - staying in validating with feedback'
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setValidationResult(`Error: ${data?.error || 'Failed to request changes'}`);
        return;
      }
      setValidationResult('Task kept in validating - add comment with feedback!');
      await loadTasks();
    } finally {
      setValidating(false);
    }
  }

  const visibleStatuses = mobileFilter === 'all' ? STATUSES : [mobileFilter];

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <Card>
        <div className="flex flex-col gap-4">
          {/* Row 1: Board selector and stats */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                <optgroup label="Citadel Apps">
                  {appIds.map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </optgroup>
                {externalIds.length > 0 && (
                  <optgroup label="External Projects">
                    {externalIds.map((id) => (
                      <option key={id} value={id}>🌐 {id}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-zinc-500">
                {tasks.length} tasks · todo {grouped.todo.length} · in-progress {grouped.in_progress.length}
                {lastRefreshAt && (
                  <span className="ml-2 text-zinc-400">
                    · refreshed {lastRefreshAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Inbox Button */}
            <button
              onClick={openInbox}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
              title="View all tasks awaiting input"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-xs font-medium">Inbox</span>
              {grouped.needs_input.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {grouped.needs_input.length}
                </span>
              )}
            </button>

            {/* Autopilot Toggle */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded border transition ${autopilotEnabled ? 'bg-green-50 border-green-200' : 'bg-zinc-100 border-zinc-200'}`}>
              <span className="text-xs font-medium text-zinc-700">Autopilot</span>
              <button
                onClick={() => toggleAutopilot(!autopilotEnabled)}
                disabled={settingsLoading}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 ${autopilotEnabled ? 'bg-green-500' : 'bg-zinc-400'}`}
                aria-pressed={autopilotEnabled}
                title={autopilotEnabled ? 'Autopilot is enabled - cron runs every 15 min' : 'Autopilot is disabled - manual trigger still works'}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autopilotEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                />
              </button>
              <span className={`text-[10px] uppercase tracking-wide ${autopilotEnabled ? 'text-green-700' : 'text-zinc-500'}`}>
                {autopilotEnabled ? 'On' : 'Off'}
              </span>
            </div>

            {isLive && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-amber-50 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-medium text-amber-700">Live</span>
              </div>
            )}
            {agentLock?.locked && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-red-50 border border-red-200" title={`Agent busy with task #${agentLock.taskId}`}>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-medium text-red-700">Agent Busy</span>
              </div>
            )}
            <Button variant="secondary" onClick={triggerAgent} disabled={triggering}>
              {triggering ? '…' : 'Trigger'}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              + New
            </Button>
          </div>
        </div>
        
        {triggerResult && (
          <div className="mt-3 text-xs text-zinc-600">{triggerResult}</div>
        )}

        {/* External Project Info Panel */}
        {isExternal(appId) && (() => {
          const project = getExternalProject(appId);
          if (!project) return null;
          return (
            <div className="mt-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50/50">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌐</span>
                  <span className="font-medium text-indigo-900">{project.name}</span>
                </div>
                {project.description && (
                  <p className="text-xs text-indigo-600">{project.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {project.liveUrl && (
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Live Site
                    </a>
                  )}
                  {project.repoUrl && (
                    <a
                      href={project.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded hover:bg-indigo-50 transition"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                      </svg>
                      Repo
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Mobile filter - only show on small screens */}
      <div className="xl:hidden">
        <Label>Filter status</Label>
        <div className="mt-1 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
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

      {/* Board columns - horizontal scroll on mobile/tablet, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto pb-4 xl:grid xl:grid-cols-5 xl:overflow-visible snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:mx-0 xl:px-0">
        {visibleStatuses.map((s) => (
          <div
            key={s}
            className="flex-shrink-0 w-[calc(100vw-2rem)] sm:w-[320px] xl:w-auto snap-start"
          >
            <Card className={`h-full max-h-[calc(100vh-240px)] xl:max-h-[calc(100vh-260px)] flex flex-col ${STATUS_COLORS[s]}`}>
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
                      {t.status === 'validating' && (
                        <span className="flex items-center gap-0.5 text-indigo-600 font-medium" title="In validation">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          V{t.validation_rounds ?? 0}/5
                        </span>
                      )}
                      {t.acceptance_criteria && (
                        <span className="flex items-center gap-0.5 text-blue-600" title="Has acceptance criteria">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          AC
                        </span>
                      )}
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
                              : t.status === 'validating'
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(sessionLogUrl(t.session_id as string), '_blank', 'noopener,noreferrer');
                          }}
                        >
                          {t.status === 'in_progress' || t.status === 'validating' ? (
                            <>
                              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${t.status === 'validating' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                              {t.status === 'validating' ? 'Awaiting review' : 'View session'}
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
              <div className="md:col-span-2">
                <Label>Acceptance Criteria</Label>
                <Textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} rows={3} placeholder="What needs to be true for this task to be complete?" />
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
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triggerImmediately}
                    onChange={(e) => setTriggerImmediately(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="text-sm text-zinc-700">Trigger autopilot immediately after creation</span>
                </label>
                <p className="text-xs text-zinc-500 mt-1 ml-6">
                  Starts an autopilot run right away to work on this task.
                </p>
              </div>
            </div>

            {createResult && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${createResult.triggered ? 'bg-green-50 text-green-700 border border-green-200' : createResult.message?.includes('created') ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {createResult.message}
              </div>
            )}

            <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => setCreateOpen(false)}
                disabled={createLoading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={createTask}
                disabled={!title.trim() || createLoading}
                className="w-full sm:w-auto"
              >
                {createLoading ? 'Creating...' : triggerImmediately ? 'Create & Trigger' : 'Create task'}
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
              <div className="md:col-span-2">
                <Label>Acceptance Criteria</Label>
                <Textarea rows={4} value={mAcceptanceCriteria} onChange={(e) => setMAcceptanceCriteria(e.target.value)} placeholder="What needs to be true for this task to be complete?" />
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
                  <optgroup label="Citadel Apps">
                    {appIds.map((id) => <option key={id} value={id}>{id}</option>)}
                  </optgroup>
                  {externalIds.length > 0 && (
                    <optgroup label="External Projects">
                      {externalIds.map((id) => <option key={id} value={id}>🌐 {id}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={saveModal}>Save</Button>
              <button className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 active:bg-zinc-100" onClick={() => moveTask(openTask, 'up')}>Move up</button>
              <button className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 active:bg-zinc-100" onClick={() => moveTask(openTask, 'down')}>Move down</button>
            </div>

            {/* Blocked task panel - show Resume button with session history */}
            {(openTask.status === 'blocked' || openTask.status === 'needs_input') && openTask.session_id && (
              <div className="mt-4 p-4 rounded-lg border border-red-200 bg-red-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-red-900">
                      {openTask.status === 'needs_input' ? 'Awaiting Input' : 'Task Blocked'}
                    </div>
                    <div className="text-xs text-red-600">
                      Session: <span className="font-mono">{openTask.session_id.slice(0, 20)}...</span>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
                
                <div className="text-xs text-red-700 mb-3">
                  {openTask.status === 'needs_input' 
                    ? 'This task is waiting for your input. Add a comment with your answer and click Resume.'
                    : 'This task is blocked. Add a comment with information to unblock and click Resume.'}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={resumeBlockedTask}
                    disabled={validating || !commentText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Resume Session
                  </button>
                </div>

                {validationResult && (
                  <div className={`mt-3 text-sm ${validationResult.includes('Error') || validationResult.includes('failed') ? 'text-red-600' : 'text-green-700'}`}>
                    {validationResult}
                  </div>
                )}

                <div className="mt-3 text-xs text-red-600 bg-red-100/50 rounded px-2 py-1.5">
                  💡 <strong>Tip:</strong> Type your answer in the comment box below, then click Resume to continue the session.
                </div>
              </div>
            )}
            {openTask.status === 'validating' && (
              <div className="mt-4 p-4 rounded-lg border border-indigo-200 bg-indigo-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-indigo-900">Validation Review</div>
                    <div className="text-xs text-indigo-600">
                      Round {openTask.validation_rounds ?? 0} of 5
                      {(openTask.validation_rounds ?? 0) >= 5 && (
                        <span className="ml-2 text-red-600 font-medium">⚠️ Max rounds reached - decision required</span>
                      )}
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                </div>
                
                <div className="text-xs text-indigo-700 mb-3">
                  This task is waiting for human validation. Review the work and choose an action:
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={approveTask}
                    disabled={validating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 text-white px-3 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve (→ Done)
                  </button>
                  <button
                    onClick={needsChangesTask}
                    disabled={validating || (openTask.validation_rounds ?? 0) >= 5}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 text-white px-3 py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Needs Changes (Stay)
                  </button>
                  <button
                    onClick={rejectTask}
                    disabled={validating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject (→ In Progress)
                  </button>
                </div>

                {validationResult && (
                  <div className={`mt-3 text-sm ${validationResult.includes('Error') ? 'text-red-600' : 'text-green-700'}`}>
                    {validationResult}
                  </div>
                )}

                <div className="mt-3 text-xs text-indigo-600 bg-indigo-100/50 rounded px-2 py-1.5">
                  💡 <strong>Tip:</strong> Add a comment below with specific feedback. The agent will continue from this session.
                </div>
              </div>
            )}

            {/* Session info */}
            {openTask.session_id && (
              <div className="mt-4 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Session</div>
                    <div className="text-sm font-mono text-zinc-700 truncate max-w-[200px] sm:max-w-[300px]">{openTask.session_id}</div>
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
                  <div className="flex gap-2">
                    {/* Resume button for blocked/needs_input tasks */}
                    {(openTask.status === 'blocked' || openTask.status === 'needs_input') && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                        onClick={resumeBlockedTask}
                        disabled={validating}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Resume
                      </button>
                    )}
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition ${
                        openTask.status === 'in_progress'
                          ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : openTask.status === 'validating'
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                      }`}
                      onClick={() => window.open(sessionLogUrl(openTask.session_id as string), '_blank', 'noopener,noreferrer')}
                    >
                      {openTask.status === 'in_progress' || openTask.status === 'validating' ? (
                        <>
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${openTask.status === 'validating' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                          {openTask.status === 'validating' ? 'Awaiting Review' : 'View Live'}
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
              </div>
            )}

            <div className="mt-6 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Plans
                {plans.length > 0 && (
                  <span className="text-xs text-zinc-500 font-normal">({plans.length})</span>
                )}
              </div>
              
              {plansLoading ? (
                <div className="text-sm text-zinc-500">Loading plans...</div>
              ) : (
                <>
                  {plans.map((p) => (
                    <div key={p.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-zinc-900">{p.title}</div>
                        <div className="text-xs text-zinc-500">v{p.version}</div>
                      </div>
                      <div className="whitespace-pre-wrap text-zinc-700 text-sm max-h-32 overflow-y-auto">{p.content}</div>
                      <div className="mt-2 text-xs text-zinc-400">{new Date(p.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                  {plans.length === 0 && <p className="text-sm text-zinc-500">No plans yet.</p>}
                  
                  {/* Create new plan */}
                  <div className="mt-3 pt-3 border-t border-zinc-100">
                    <div className="text-xs font-medium text-zinc-600 mb-2">Add new plan</div>
                    <Input 
                      value={planTitle} 
                      onChange={(e) => setPlanTitle(e.target.value)} 
                      placeholder="Plan title" 
                      className="mb-2"
                    />
                    <Textarea 
                      value={planContent} 
                      onChange={(e) => setPlanContent(e.target.value)} 
                      rows={4} 
                      placeholder="Plan content (markdown supported)" 
                      className="mb-2"
                    />
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={planExportToKb}
                        onChange={(e) => setPlanExportToKb(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      />
                      <span className="text-xs text-zinc-600">Export to /kb/plans/{appId}/</span>
                    </label>
                    <Button 
                      onClick={createPlan} 
                      disabled={!planTitle.trim() || planCreating}
                      variant="secondary"
                    >
                      {planCreating ? 'Creating...' : 'Add Plan'}
                    </Button>
                  </div>
                </>
              )}
            </div>

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

      {/* Inbox Modal */}
      {inboxOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6" onClick={() => setInboxOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="text-lg font-semibold">Input Inbox</h3>
                <span className="text-sm text-zinc-500">({inboxTasks.length} awaiting input)</span>
              </div>
              <button 
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 active:bg-zinc-100" 
                onClick={() => setInboxOpen(false)}
              >
                Close
              </button>
            </div>

            {inboxLoading ? (
              <div className="py-12 text-center text-zinc-500">
                <div className="inline-flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </div>
              </div>
            ) : inboxError ? (
              <div className="py-8 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">
                {inboxError}
              </div>
            ) : inboxTasks.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">
                <svg className="w-12 h-12 mx-auto text-zinc-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-lg font-medium">No tasks awaiting input</p>
                <p className="text-sm text-zinc-400 mt-1">All caught up! Check back later.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inboxTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                            task.priority === 'high' ? 'bg-red-100 text-red-700' :
                            task.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {task.priority}
                          </span>
                          <span className="text-xs text-zinc-500">{task.board_app_id}</span>
                          {task.input_deadline_at && (
                            <span className={`text-xs ${
                              new Date(task.input_deadline_at) < new Date() 
                                ? 'text-red-600 font-medium' 
                                : 'text-zinc-500'
                            }`}>
                              Due {new Date(task.input_deadline_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-zinc-900 truncate">{task.title}</h4>
                      </div>
                      <button
                        onClick={() => openTaskFromInbox(task.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition"
                      >
                        Answer
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {task.questions.map((q, idx) => (
                        <div key={q.id} className="rounded bg-white border border-purple-100 p-3">
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm text-zinc-800">{q.question}</p>
                              {q.options && q.options.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {q.options.map((opt, optIdx) => (
                                    <span 
                                      key={optIdx}
                                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-zinc-100 text-zinc-700 border border-zinc-200"
                                    >
                                      {optIdx + 1}. {opt}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="mt-1.5 text-[10px] text-zinc-400">
                                Asked {formatRelativeTime(q.asked_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
