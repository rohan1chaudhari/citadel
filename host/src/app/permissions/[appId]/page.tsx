'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { PermissionConsent, type PermissionScopes } from '@/components/PermissionConsent';

export default function AppPermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const appId = (params?.appId as string) ?? '';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState('');
  const [requestedPermissions, setRequestedPermissions] = useState<PermissionScopes>({});

  useEffect(() => {
    if (!appId) return;
    fetch(`/api/permissions?app=${encodeURIComponent(appId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setAppName(data.appName);
          setRequestedPermissions(data.requested);
        } else {
          setError(data.error || 'Failed to load permissions');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load permissions');
        setLoading(false);
      });
  }, [appId]);

  const handleSubmit = async (granted: PermissionScopes) => {
    setSaving(true);
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, scopes: granted }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push('/permissions');
      } else {
        setError(data.error || 'Failed to save permissions');
        setSaving(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save permissions');
      setSaving(false);
    }
  };

  const handleDeny = async () => {
    // Revoke all permissions
    await fetch(`/api/permissions?app=${encodeURIComponent(appId)}`, {
      method: 'DELETE',
    });
    router.push('/permissions');
  };

  if (loading) {
    return (
      <Shell title="App Permissions" subtitle="Loading...">
        <p className="text-zinc-600">Loading permissions...</p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell title="App Permissions" subtitle="Error">
        <p className="text-red-600">{error}</p>
      </Shell>
    );
  }

  return (
    <Shell title={appName} subtitle="Manage Permissions">
      <PermissionConsent
        appId={appId}
        appName={appName}
        permissions={requestedPermissions}
        onSubmit={handleSubmit}
        onDeny={handleDeny}
      />
      
      {saving && (
        <p className="text-sm text-zinc-500 mt-4">Saving permissions...</p>
      )}
    </Shell>
  );
}
