export async function listApps(_includeHidden = false): Promise<Array<{ id: string; name?: string; permissions?: string[] }>> {
  const host = (process.env.CITADEL_HOST || 'http://localhost:3000').replace(/\/$/, '');
  try {
    const res = await fetch(`${host}/api/apps`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.apps) ? data.apps : [];
  } catch {
    return [];
  }
}
