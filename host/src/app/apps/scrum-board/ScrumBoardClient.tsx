'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Label, LinkA } from '@/components/Shell';

type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'needs_input'
  | 'blocked'
  | 'done'
  | 'failed';

type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  priority: 'high' | 'medium' | 'low';
  assignee: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  attempt_count: number;
  max_attempts: number;
  comment_count: number;
  created_at: string;
  updated_at: string | null;
};

const APPS = [
  { id: 'smart-notes', name: 'Smart Notes' },
  { id: 'gym-tracker', name: 'Gym Tracker' },
  { id: 'soumil-mood-tracker', name: 'Mood Tracker' },
  { id: 'scrum-board', name: 'Scrum Board' },
  { id: 'citadel', name: 'Citadel (Host)' },
];

const STATUS_ORDER: Record<TaskStatus, number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  needs_input: 3,
  blocked: 4,
  done: 5,
  failed: 6,
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  needs_input: 'Needs Input',
  blocked: 'Blocked',
  done: 'Done',
  failed: 'Failed',
};

export default function ScrumBoardPage() {
  const [selectedApp, setSelectedApp] = useState<string>(APPS[0].id);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/scrum-board/tasks?app=${encodeURIComponent(selectedApp)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to load tasks');
      setTasks(data.tasks || []);
    } catch (e: any) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp]);

  async function triggerAgent() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const app = APPS.find((a) => a.id === selectedApp);
      const res = await fetch('/api/apps/scrum-board/trigger', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appId: selectedApp,
          appName: app?.name || selectedApp,
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

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks || []) {
      const k = t.status || 'backlog';
      if (!map[k]) map[k] = [];
      map[k].push(t);
    }
    return map;
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label>Select App</Label>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
          >
            {APPS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={triggerAgent} disabled={triggering}>
          {triggering ? 'Triggering…' : 'Trigger Agent'}
        </Button>
        <Button variant="secondary" onClick={loadTasks} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {triggerResult && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {triggerResult}
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(grouped)
          .sort((a, b) => (STATUS_ORDER[a[0] as TaskStatus] ?? 99) - (STATUS_ORDER[b[0] as TaskStatus] ?? 99))
          .map(([status, items]) => (
            <div key={status} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">{STATUS_LABEL[status as TaskStatus]}</h3>
                <span className="text-xs text-zinc-500">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((t) => (
                  <Card key={t.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-zinc-900">{t.title}</div>
                      <PriorityBadge p={t.priority} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      {t.assignee && <span>@{t.assignee}</span>}
                      {t.claimed_by && <span className="text-amber-600">claimed by {t.claimed_by}</span>}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500">{t.comment_count} comments</span>
                        <span className="text-zinc-500">attempt {t.attempt_count}/{t.max_attempts}</span>
                      </div>
                      <LinkA href={`/apps/scrum-board/task/${t.id}`}>Open</LinkA>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
      </div>

      {!loading && tasks?.length === 0 && (
        <div className="text-sm text-zinc-500">No tasks for {APPS.find((a) => a.id === selectedApp)?.name}.</div>
      )}
    </div>
  );
}

function PriorityBadge({ p }: { p: Task['priority'] }) {
  const color =
    p === 'high' ? 'bg-red-100 text-red-700' : p === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-700';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${color}`}>{p}</span>;
}
