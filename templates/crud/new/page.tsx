import { Shell, LinkA, Card } from '@/components/Shell';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';
import { ItemFormClient } from '../ItemFormClient';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

export const metadata = {
  title: 'New Item - {{app_name}}'
};

export default async function NewItemPage() {
  await requirePermissionConsent(APP_ID);

  return (
    <Shell title="{{app_name}}" subtitle="Create a new item">
      <div className="mb-4">
        <LinkA href="/apps/{{app_id}}">← Back to items</LinkA>
      </div>

      <Card>
        <ItemFormClient mode="create" />
      </Card>
    </Shell>
  );
}
