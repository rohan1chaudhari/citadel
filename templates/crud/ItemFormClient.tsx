'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Item {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

interface ItemFormClientProps {
  mode: 'create' | 'edit';
  item?: Item;
}

export function ItemFormClient({ mode, item }: ItemFormClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: item?.title || '',
    description: item?.description || '',
    status: item?.status || 'active'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const url = mode === 'create'
        ? '/api/apps/{{app_id}}/items/create'
        : '/api/apps/{{app_id}}/items/update';

      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(mode === 'edit' && item ? { id: item.id } : {}),
          ...formData
        })
      });

      if (res.ok) {
        router.push('/apps/{{app_id}}');
        router.refresh();
      } else {
        const data = await res.json();
        setErrors({ submit: data.error || 'Failed to save item' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className={`w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-900 ${
            errors.title
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-zinc-200 dark:border-zinc-700 focus:border-zinc-500 focus:ring-zinc-500'
          }`}
          placeholder="Enter title..."
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-900 focus:border-zinc-500 focus:ring-zinc-500"
          placeholder="Enter description..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Status
        </label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-900 focus:border-zinc-500 focus:ring-zinc-500"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {errors.submit && (
        <p className="text-sm text-red-600">{errors.submit}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create Item' : 'Save Changes'}
        </button>
        <a
          href="/apps/{{app_id}}"
          className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
