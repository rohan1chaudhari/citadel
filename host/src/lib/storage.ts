import fsp from 'node:fs/promises';
import path from 'node:path';
import { assertAppId } from '@/lib/appIds';
import { appDataRoot } from '@/lib/paths';
import { audit } from '@/lib/audit';

function resolveScoped(appId: string, rel: string) {
  assertAppId(appId);
  const root = path.resolve(appDataRoot(appId));
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error('Path escapes app storage root');
  }
  return abs;
}

export async function storageWriteText(appId: string, rel: string, content: string) {
  const abs = resolveScoped(appId, rel);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, content, 'utf8');
  audit(appId, 'storage.write', { path: rel, bytes: Buffer.byteLength(content, 'utf8') });
}

export async function storageReadText(appId: string, rel: string) {
  const abs = resolveScoped(appId, rel);
  const text = await fsp.readFile(abs, 'utf8');
  audit(appId, 'storage.read', { path: rel, bytes: Buffer.byteLength(text, 'utf8') });
  return text;
}
