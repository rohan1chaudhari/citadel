// Example page.tsx - copy to: host/src/app/apps/hello-world/page.tsx
import { Shell } from '@/components/Shell';
import { dbQuery } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';

export const runtime = 'nodejs';
const APP_ID = 'hello-world';

export default async function HelloWorldPage() {
  // Check and require permission consent on first visit
  await requirePermissionConsent(APP_ID);

  // Query data from app's database
  const rows = dbQuery<{ id: number; message: string; created_at: string }>(
    APP_ID,
    'SELECT id, message, created_at FROM greetings ORDER BY created_at DESC'
  );

  return (
    <Shell title="Hello World" subtitle="A minimal Citadel app">
      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Welcome!</h2>
          <p className="mt-2 text-zinc-600">
            This is a minimal example app demonstrating the Citadel app package spec.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="text-base font-medium text-zinc-900">Greetings from the database:</h3>
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <div 
                key={row.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3"
              >
                <span className="text-zinc-900">{row.message}</span>
                <span className="text-sm text-zinc-500">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Check out the source in{' '}
            <code className="rounded bg-blue-100 px-1 py-0.5">docs/examples/hello-world/</code>
          </p>
        </div>
      </div>
    </Shell>
  );
}
