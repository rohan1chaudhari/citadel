import { Shell, LinkA, Card } from '@/components/Shell';
import { dbQuery } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';
import { ItemFormClient } from '../ItemFormClient';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditItemPage({ params }: Props) {
  await requirePermissionConsent(APP_ID);
  const { id } = await params;

  const items = dbQuery<{
    id: number;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string | null;
  }>(
    APP_ID,
    'SELECT id, title, description, status, created_at, updated_at FROM items WHERE id = ?',
    [id]
  );

  if (items.length === 0) {
    return (
      <Shell title="{{app_name}}" subtitle="Item not found">
        <div className="mb-4">
          <LinkA href="/apps/{{app_id}}">← Back to items</LinkA>
        </div>
        <p className="text-zinc-500">The item you're looking for doesn't exist.</p>
      </Shell>
    );
  }

  const item = JSON.parse(
    JSON.stringify(items[0], (k, v) => (typeof v === 'bigint' ? Number(v) : v))
  );

  return (
    <Shell title="{{app_name}}" subtitle="Edit item">
      <div className="mb-4">
        <LinkA href="/apps/{{app_id}}">← Back to items</LinkA>
      </div>

      <Card>
        <ItemFormClient mode="edit" item={item} />
      </Card>
    </Shell>
  );
}
