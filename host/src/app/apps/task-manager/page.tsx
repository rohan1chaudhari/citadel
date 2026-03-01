import { Shell, LinkA, Card } from '@/components/Shell';
import { dbQuery } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';

export const runtime = 'nodejs';
const APP_ID = 'task-manager';

interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string | null;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[priority as keyof typeof colors] || colors.medium}`}>
      {priority}
    </span>
  );
}

export default async function TaskManagerPage() {
  await requirePermissionConsent(APP_ID);

  const tasks = dbQuery<Task>(
    APP_ID,
    `SELECT id, title, description, priority, status, created_at, updated_at 
     FROM tasks 
     ORDER BY 
       CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       created_at DESC 
     LIMIT 500`
  );

  const activeCount = tasks.filter(t => t.status === 'active').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  // Serialize to handle BigInt
  const serializedTasks = JSON.parse(
    JSON.stringify(tasks, (k, v) => (typeof v === 'bigint' ? Number(v) : v))
  );

  return (
    <Shell title="Task Manager" subtitle="Organize your work">
      <div className="flex items-center justify-between mb-6">
        <LinkA href="/">← home</LinkA>
        <LinkA 
          href="/apps/task-manager/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          + New Task
        </LinkA>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="text-center">
          <div className="text-2xl font-bold">{tasks.length}</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Total Tasks</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{activeCount}</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Active</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Completed</div>
        </Card>
      </div>

      <Card>
        {serializedTasks.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-lg mb-2">No tasks yet</p>
            <p className="text-sm">Create your first task to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {serializedTasks.map((task: Task) => (
              <a
                key={task.id}
                href={`/apps/task-manager/${task.id}`}
                className="block p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-medium truncate ${task.status === 'completed' ? 'line-through text-zinc-500' : ''}`}>
                        {task.title}
                      </h3>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    {task.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 ml-4">
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}
