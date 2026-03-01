'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Shell, Card, Button } from '@/components/Shell';
import { PermissionConsent, type PermissionScopes } from '@/components/PermissionConsent';

export default function AppConsentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const appId = (params?.appId as string) ?? '';
  const returnTo = searchParams?.get('returnTo') || `/apps/${appId}`;
  
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
          // If already granted, redirect to app
          if (!data.needsConsent) {
            router.replace(returnTo);
          }
        } else {
          setError(data.error || 'Failed to load app permissions');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load app permissions');
        setLoading(false);
      });
  }, [appId, returnTo, router]);

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
        router.replace(returnTo);
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
    // Revoke all permissions and go back to home
    await fetch(`/api/permissions?app=${encodeURIComponent(appId)}`, {
      method: 'DELETE',
    });
    router.replace('/');
  };

  if (loading) {
    return (
      <Shell title="App Permissions" subtitle="Loading...">
        <Card>
          <p className="text-zinc-600">Loading permissions...</p>
        </Card>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell title="App Permissions" subtitle="Error">
        <Card>
          <p className="text-red-600">{error}</p>
          <div className="mt-4">
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title="Permission Request" subtitle={`${appName} needs your permission to access the following:`}>
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
      
      <div className="mt-6 text-sm text-zinc-500">
        <p>
          You can change these permissions anytime from{' '}
          <a href="/permissions" className="text-zinc-700 hover:text-zinc-900 underline">
            Settings → Permissions
          </a>
        </p>
      </div>
    </Shell>
  );
}
