import { Shell, Card } from '@/components/Shell';
import { listApps, type AppManifest } from '@citadel/core';
import { getAppPermissions, getAllAppPermissions, type AppPermissions, type PermissionScopes } from '@citadel/core';
import Link from 'next/link';

export const runtime = 'nodejs';

function PermissionBadge({ granted, total }: { granted: number; total: number }) {
  if (total === 0) {
    return <span className="text-xs text-zinc-400">No permissions needed</span>;
  }
  if (granted === 0) {
    return <span className="text-xs rounded-full bg-red-50 text-red-700 px-2 py-1">Not granted</span>;
  }
  if (granted === total) {
    return <span className="text-xs rounded-full bg-green-50 text-green-700 px-2 py-1">All granted</span>;
  }
  return <span className="text-xs rounded-full bg-yellow-50 text-yellow-700 px-2 py-1">{granted}/{total} granted</span>;
}

function countPermissions(scopes: PermissionScopes): number {
  let count = 0;
  if (scopes.db?.read) count++;
  if (scopes.db?.write) count++;
  if (scopes.storage?.read) count++;
  if (scopes.storage?.write) count++;
  if (scopes.ai) count++;
  if (scopes.network) count += scopes.network.length;
  return count;
}

function formatPermissions(scopes: PermissionScopes): string[] {
  const parts: string[] = [];
  if (scopes.db?.read) parts.push('DB Read');
  if (scopes.db?.write) parts.push('DB Write');
  if (scopes.storage?.read) parts.push('Storage Read');
  if (scopes.storage?.write) parts.push('Storage Write');
  if (scopes.ai) parts.push('AI');
  if (scopes.network?.length) parts.push(`Network (${scopes.network.length})`);
  return parts;
}

export default async function PermissionsPage() {
  const apps = await listApps(true); // include hidden
  const allPermissions = getAllAppPermissions();
  const permsByApp = new Map(allPermissions.map((p) => [p.appId, p]));

  return (
    <Shell title="App Permissions" subtitle="Manage permissions for installed apps">
      <div className="space-y-4">
        {apps.map((app) => {
          const granted = permsByApp.get(app.id);
          const requested = app.permissions ?? {};
          const requestedCount = countPermissions(requested);
          const grantedCount = granted ? countPermissions(granted.scopes) : 0;
          
          return (
            <Card key={app.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-zinc-900 truncate">{app.name}</h3>
                    <PermissionBadge granted={grantedCount} total={requestedCount} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{app.id}</p>
                  
                  {granted && (
                    <p className="text-sm text-zinc-600 mt-2">
                      Granted: {formatPermissions(granted.scopes).join(', ') || 'None'}
                    </p>
                  )}
                  
                  {!granted && requestedCount > 0 && (
                    <p className="text-sm text-zinc-500 mt-2">Permissions not yet granted</p>
                  )}
                </div>
                
                <div className="shrink-0">
                  <Link
                    href={`/permissions/${app.id}`}
                    className="text-sm text-zinc-700 hover:text-zinc-900 whitespace-nowrap"
                  >
                    {granted ? 'Edit' : 'Grant'} →
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
        
        {apps.length === 0 && (
          <Card>
            <p className="text-zinc-600 text-center py-8">No apps installed.</p>
          </Card>
        )}
      </div>
    </Shell>
  );
}
