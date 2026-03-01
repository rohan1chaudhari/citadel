'use client';

import { useState } from 'react';
import { Card, Button } from '@/components/Shell';

export type PermissionScopes = {
  db?: { read?: boolean; write?: boolean };
  storage?: { read?: boolean; write?: boolean };
  ai?: boolean;
  network?: string[];
};

function PermissionIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    db: '🗄️',
    storage: '💾',
    ai: '🤖',
    network: '🌐',
  };
  return <span className="text-xl">{icons[type] || '🔐'}</span>;
}

function PermissionLabel({ type, operation }: { type: string; operation?: string }) {
  const labels: Record<string, string> = {
    'db.read': 'Read Database',
    'db.write': 'Write Database',
    'storage.read': 'Read Files',
    'storage.write': 'Write Files',
    'ai': 'AI Access',
    'network': 'Network Access',
  };
  return <span>{labels[`${type}.${operation}`] || labels[type] || type}</span>;
}

function PermissionDescription({ type, operation }: { type: string; operation?: string }) {
  const descriptions: Record<string, string> = {
    'db.read': 'Read data from the app database',
    'db.write': 'Create, update, and delete data in the app database',
    'storage.read': 'Read files from app storage',
    'storage.write': 'Save files to app storage',
    'ai': 'Access AI services (e.g., OpenAI, Anthropic)',
    'network': 'Connect to external services and APIs',
  };
  return <p className="text-sm text-zinc-500">{descriptions[`${type}.${operation}`] || descriptions[type] || ''}</p>;
}

interface PermissionConsentProps {
  appId: string;
  appName: string;
  permissions: PermissionScopes;
  onSubmit: (grantedPermissions: PermissionScopes) => void;
  onDeny: () => void;
}

export function PermissionConsent({ appId, appName, permissions, onSubmit, onDeny }: PermissionConsentProps) {
  const [granted, setGranted] = useState<PermissionScopes>({
    db: { read: permissions.db?.read ?? false, write: permissions.db?.write ?? false },
    storage: { read: permissions.storage?.read ?? false, write: permissions.storage?.write ?? false },
    ai: permissions.ai ?? false,
    network: permissions.network ?? [],
  });

  const toggleDb = (op: 'read' | 'write') => {
    setGranted((prev) => ({
      ...prev,
      db: { ...prev.db, [op]: !prev.db?.[op] },
    }));
  };

  const toggleStorage = (op: 'read' | 'write') => {
    setGranted((prev) => ({
      ...prev,
      storage: { ...prev.storage, [op]: !prev.storage?.[op] },
    }));
  };

  const toggleAi = () => {
    setGranted((prev) => ({ ...prev, ai: !prev.ai }));
  };

  const toggleNetworkDomain = (domain: string) => {
    setGranted((prev) => {
      const current = prev.network ?? [];
      const hasDomain = current.includes(domain);
      const next = hasDomain
        ? current.filter((d) => d !== domain)
        : [...current, domain];
      return { ...prev, network: next };
    });
  };

  const hasAnyRequested = 
    (permissions.db?.read || permissions.db?.write || 
     permissions.storage?.read || permissions.storage?.write || 
     permissions.ai || 
     (permissions.network?.length ?? 0) > 0);

  if (!hasAnyRequested) {
    return (
      <Card>
        <p className="text-zinc-600">{appName} does not require any permissions.</p>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => onSubmit({})}>Continue</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Permission Request</h2>
          <p className="text-sm text-zinc-600">
            <strong>{appName}</strong> is requesting the following permissions. 
            You can approve or deny each permission individually.
          </p>
        </div>

        {permissions.db?.read || permissions.db?.write ? (
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <PermissionIcon type="db" />
              <span className="font-medium text-zinc-900">Database Access</span>
            </div>
            <div className="space-y-2 pl-8">
              {permissions.db?.read && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={granted.db?.read}
                    onChange={() => toggleDb('read')}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <PermissionLabel type="db" operation="read" />
                    <PermissionDescription type="db" operation="read" />
                  </div>
                </label>
              )}
              {permissions.db?.write && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={granted.db?.write}
                    onChange={() => toggleDb('write')}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <PermissionLabel type="db" operation="write" />
                    <PermissionDescription type="db" operation="write" />
                  </div>
                </label>
              )}
            </div>
          </div>
        ) : null}

        {permissions.storage?.read || permissions.storage?.write ? (
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <PermissionIcon type="storage" />
              <span className="font-medium text-zinc-900">Storage Access</span>
            </div>
            <div className="space-y-2 pl-8">
              {permissions.storage?.read && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={granted.storage?.read}
                    onChange={() => toggleStorage('read')}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <PermissionLabel type="storage" operation="read" />
                    <PermissionDescription type="storage" operation="read" />
                  </div>
                </label>
              )}
              {permissions.storage?.write && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={granted.storage?.write}
                    onChange={() => toggleStorage('write')}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <PermissionLabel type="storage" operation="write" />
                    <PermissionDescription type="storage" operation="write" />
                  </div>
                </label>
              )}
            </div>
          </div>
        ) : null}

        {permissions.ai && (
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <PermissionIcon type="ai" />
              <span className="font-medium text-zinc-900">AI Access</span>
            </div>
            <label className="flex items-start gap-3 cursor-pointer pl-8">
              <input
                type="checkbox"
                checked={granted.ai}
                onChange={toggleAi}
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <div>
                <PermissionLabel type="ai" />
                <PermissionDescription type="ai" />
              </div>
            </label>
          </div>
        )}

        {permissions.network && permissions.network.length > 0 && (
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <PermissionIcon type="network" />
              <span className="font-medium text-zinc-900">Network Access</span>
            </div>
            <div className="space-y-2 pl-8">
              {permissions.network.map((domain) => (
                <label key={domain} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={granted.network?.includes(domain)}
                    onChange={() => toggleNetworkDomain(domain)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <span className="font-medium text-zinc-700">{domain}</span>
                    <p className="text-sm text-zinc-500">Allow connections to {domain}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-zinc-100 pt-4 flex gap-3">
          <Button onClick={() => onSubmit(granted)}>Approve Selected</Button>
          <Button variant="secondary" onClick={onDeny}>Deny All</Button>
        </div>
      </div>
    </Card>
  );
}
