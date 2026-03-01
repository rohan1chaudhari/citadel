import { Shell } from '@/components/Shell';
import { dbQuery } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

interface Greeting {
  id: number;
  message: string;
  created_at: string;
}

export default async function {{AppName}}Page() {
  // Check and require permission consent on first visit
  await requirePermissionConsent(APP_ID);

  // Example: query the database
  const greetings = dbQuery<Greeting>(
    APP_ID,
    'SELECT id, message, created_at FROM greetings ORDER BY created_at DESC LIMIT 10'
  );

  return (
    <Shell title="{{app_name}}" subtitle="Your app description here.">
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          Welcome to your new Citadel app! This is a blank template to get you started.
        </p>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Recent Greetings</h2>
          {greetings.length === 0 ? (
            <p className="text-sm text-zinc-500">No greetings yet. Call the API to add some!</p>
          ) : (
            <ul className="space-y-2">
              {greetings.map((g) => (
                <li key={g.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                  {g.message}
                  <span className="text-zinc-400 ml-2">{new Date(g.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-sm text-zinc-500">
          <p>Next steps:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Edit this page in <code>page.tsx</code></li>
            <li>Add API routes in <code>api/</code></li>
            <li>Create database migrations in <code>migrations/</code></li>
            <li>Update <code>app.yaml</code> with your app's permissions</li>
          </ul>
        </div>
      </div>
    </Shell>
  );
}
