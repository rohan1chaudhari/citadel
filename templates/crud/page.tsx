import { Shell, LinkA, Card } from '@/components/Shell';
import { dbQuery } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';
import { ItemsListClient } from './ItemsListClient';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

interface Item {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export default async function {{AppName}}Page() {
  await requirePermissionConsent(APP_ID);

  const items = dbQuery<Item>(
    APP_ID,
    `SELECT id, title, description, status, created_at, updated_at 
     FROM items 
     ORDER BY created_at DESC 
     LIMIT 500`
  );

  // Serialize to handle BigInt
  const serializedItems = JSON.parse(
    JSON.stringify(items, (k, v) => (typeof v === 'bigint' ? Number(v) : v))
  );

  return (
    <Shell title="{{app_name}}" subtitle="Manage your items">
      <div className="flex items-center justify-between mb-4">
        <LinkA href="/">← home</LinkA>
        <LinkA 
          href="/apps/{{app_id}}/new"
          className="inline-flex items-center px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          + New Item
        </LinkA>
      </div>

      <Card>
        <ItemsListClient initialItems={serializedItems} />
      </Card>
    </Shell>
  );
}
