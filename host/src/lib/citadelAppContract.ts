export type AppPermission =
  | 'notifications'
  | 'camera'
  | 'microphone'
  | 'gallery'
  | 'filesystem'
  | 'agent:run';

export type CitadelAppContractV0 = {
  id: string;
  name: string;
  version: string;
  entry: string;
  health: string;
  permissions: AppPermission[];
  events?: string;
  meta?: string;
  agentCallback?: string;
};

export type ContractValidation =
  | { ok: true; value: CitadelAppContractV0 }
  | { ok: false; errors: string[] };

const ALLOWED_PERMISSIONS = new Set<AppPermission>([
  'notifications',
  'camera',
  'microphone',
  'gallery',
  'filesystem',
  'agent:run'
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPath(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  return v.trim().startsWith('/');
}

export function validateCitadelAppContract(raw: unknown): ContractValidation {
  const errors: string[] = [];
  if (!isObject(raw)) return { ok: false, errors: ['manifest must be a JSON object'] };

  const id = String(raw.id ?? '').trim();
  const name = String(raw.name ?? '').trim();
  const version = String(raw.version ?? '').trim();
  const entry = String(raw.entry ?? '').trim();
  const health = String(raw.health ?? '').trim();

  if (!id) errors.push('id is required');
  if (!name) errors.push('name is required');
  if (!version) errors.push('version is required');
  if (!isPath(entry)) errors.push('entry must be a path starting with /');
  if (!isPath(health)) errors.push('health must be a path starting with /');

  const permissionsRaw = raw.permissions;
  const permissions: AppPermission[] = [];
  if (!Array.isArray(permissionsRaw)) {
    errors.push('permissions must be an array');
  } else {
    for (const p of permissionsRaw) {
      const v = String(p ?? '').trim() as AppPermission;
      if (!ALLOWED_PERMISSIONS.has(v)) {
        errors.push(`invalid permission: ${String(p)}`);
      } else {
        permissions.push(v);
      }
    }
  }

  const events = raw.events == null ? undefined : String(raw.events).trim();
  const meta = raw.meta == null ? undefined : String(raw.meta).trim();
  const agentCallback = raw.agentCallback == null ? undefined : String(raw.agentCallback).trim();

  if (events && !isPath(events)) errors.push('events must be a path starting with /');
  if (meta && !isPath(meta)) errors.push('meta must be a path starting with /');
  if (agentCallback && !isPath(agentCallback)) errors.push('agentCallback must be a path starting with /');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      id,
      name,
      version,
      entry,
      health,
      permissions,
      events,
      meta,
      agentCallback
    }
  };
}
