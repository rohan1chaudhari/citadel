import { Shell, Card } from '@/components/Shell';
import { listApps } from '@citadel/core';
import Link from 'next/link';
import Image from 'next/image';

export const runtime = 'nodejs';

interface RegistryApp {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];
  screenshot?: string | null;
  repository?: string;
  repo_url?: string;
  verified?: boolean;
}

async function fetchRegistry(): Promise<{ ok: boolean; apps?: RegistryApp[]; error?: string }> {
  try {
    const response = await fetch('http://localhost:3000/api/registry', {
      next: { revalidate: 60 }
    });
    
    if (!response.ok) {
      const data = await response.json();
      return { ok: false, error: data.error || 'Failed to fetch registry' };
    }

    const data = await response.json();
    return { ok: true, apps: data.apps || [] };
  } catch (err) {
    return { ok: false, error: 'Failed to connect to registry' };
  }
}

export default async function BrowsePage() {
  const [registryResult, installedApps] = await Promise.all([
    fetchRegistry(),
    listApps(true) // include hidden to get all installed apps
  ]);

  const installedAppIds = new Set(installedApps.map(app => app.id));

  return (
    <Shell title="Browse Apps" subtitle="Discover and install apps from the registry">
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/" 
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </div>

      {!registryResult.ok && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-100">Registry Unavailable</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {registryResult.error || 'Could not fetch app registry. Please check your connection and try again.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {registryResult.ok && registryResult.apps && registryResult.apps.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-zinc-500 dark:text-zinc-400">No apps available in the registry.</p>
        </Card>
      )}

      {registryResult.ok && registryResult.apps && registryResult.apps.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {registryResult.apps.map((app) => {
            const isInstalled = installedAppIds.has(app.id);
            
            return (
              <Card key={app.id} className="flex flex-col h-full">
                {/* App Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-800">
                    <Image
                      src={`/app-logos/${app.id}-logo.png`}
                      alt={app.name}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        // Fallback to placeholder if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl font-bold text-zinc-400">${app.name.charAt(0).toUpperCase()}</div>`;
                        }
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{app.name}</h3>
                      {app.verified && (
                        <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">v{app.version || '0.1.0'}</p>
                    {app.author && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">by {app.author}</p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 flex-1">
                  {app.description || 'No description available.'}
                </p>

                {/* Tags */}
                {app.tags && app.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {app.tags.slice(0, 3).map((tag) => (
                      <span 
                        key={tag}
                        className="px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  {isInstalled ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Installed
                      </span>
                      <Link
                        href={`/apps/${app.id}`}
                        className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
                      >
                        Open App
                      </Link>
                    </>
                  ) : (
                    <>
                      <form 
                        action={`/api/apps/install`}
                        method="POST"
                        className="flex-1"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const button = form.querySelector('button');
                          if (button) {
                            button.disabled = true;
                            button.innerHTML = 'Installing...';
                          }
                          
                          try {
                            const res = await fetch('/api/apps/install', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ appId: app.id })
                            });
                            
                            const data = await res.json();
                            
                            if (data.ok) {
                              window.location.href = data.url || `/apps/${app.id}`;
                            } else {
                              alert(data.error || 'Installation failed');
                              if (button) {
                                button.disabled = false;
                                button.innerHTML = 'Install';
                              }
                            }
                          } catch (err) {
                            alert('Installation failed: ' + (err instanceof Error ? err.message : String(err)));
                            if (button) {
                              button.disabled = false;
                              button.innerHTML = 'Install';
                            }
                          }
                        }}
                      >
                        <button
                          type="submit"
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-zinc-100/15"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Install
                        </button>
                      </form>
                      {app.repository && (
                        <a
                          href={app.repository}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                          title="View source"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                          </svg>
                        </a>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CLI Hint */}
      <Card className="mt-8 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700">
            <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Prefer the command line?</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              You can also install apps using the CLI:
            </p>
            <code className="block mt-2 px-3 py-2 text-sm bg-zinc-900 text-zinc-100 rounded-lg font-mono">
              citadel-app install &lt;app-id&gt;
            </code>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Run <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">citadel-app search</code> to find apps or <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">citadel-app info &lt;app-id&gt;</code> for details.
            </p>
          </div>
        </div>
      </Card>
    </Shell>
  );
}
