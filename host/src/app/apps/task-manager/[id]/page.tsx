'use client';

import { Shell, LinkA, Card } from '@/components/Shell';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
}

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/apps/task-manager/tasks/${id}`)
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            setTask(data.task);
          } else {
            setError('Task not found');
          }
          setLoading(false);
        });
    });
  }, [params]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!task) return;
    
    setSaving(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const res = await fetch(`/api/apps/task-manager/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        status: formData.get('status'),
      }),
    });

    const data = await res.json();
    
    if (data.ok) {
      router.push('/apps/task-manager');
      router.refresh();
    } else {
      setError(data.error || 'Failed to update task');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm('Delete this task?')) return;
    
    setDeleting(true);
    
    const res = await fetch(`/api/apps/task-manager/tasks/${task.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      router.push('/apps/task-manager');
      router.refresh();
    } else {
      setError('Failed to delete task');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Shell title="Edit Task" subtitle="Loading...">
        <div className="text-center py-12">Loading...</div>
      </Shell>
    );
  }

  if (error || !task) {
    return (
      <Shell title="Error" subtitle="">
        <div className="text-center py-12 text-red-600">{error || 'Task not found'}</div>
      </Shell>
    );
  }

  return (
    <Shell title="Edit Task" subtitle={task.title}>
      <div className="mb-6">
        <LinkA href="/apps/task-manager">← back to tasks</LinkA>
      </div>

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              defaultValue={task.title}
              maxLength={200}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={task.description || ''}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              name="priority"
              defaultValue={task.priority}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="status"
              defaultValue={task.status}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <a
              href="/apps/task-manager"
              className="px-4 py-2 border rounded-md font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </a>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 disabled:opacity-50 ml-auto"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
