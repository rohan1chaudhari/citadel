'use client';

import { Shell, LinkA, Card } from '@/components/Shell';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewTaskPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const res = await fetch('/api/apps/task-manager/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
      }),
    });

    const data = await res.json();
    
    if (data.ok) {
      router.push('/apps/task-manager');
      router.refresh();
    } else {
      setError(data.error || 'Failed to create task');
      setSaving(false);
    }
  }

  return (
    <Shell title="New Task" subtitle="Create a new task">
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
              maxLength={200}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
              placeholder="Add details..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              name="priority"
              defaultValue="medium"
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
            <a
              href="/apps/task-manager"
              className="px-4 py-2 border rounded-md font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
