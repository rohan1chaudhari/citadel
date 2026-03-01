'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Item {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

interface ItemsListClientProps {
  initialItems: Item[];
}

export function ItemsListClient({ initialItems }: ItemsListClientProps) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.description?.toLowerCase() || '').includes(search.toLowerCase())
  );

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/apps/{{app_id}}/items/update`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        setItems(items.filter((item) => item.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete item');
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-900"
        />
        <span className="text-sm text-zinc-500">{filteredItems.length} items</span>
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-zinc-500 text-center py-8">No items found.</p>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="py-3 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/apps/{{app_id}}/${item.id}`}
                  className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-400"
                >
                  {item.title}
                </Link>
                {item.description && (
                  <p className="text-sm text-zinc-500 truncate">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {item.status}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/apps/{{app_id}}/${item.id}`}
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {deleting === item.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
