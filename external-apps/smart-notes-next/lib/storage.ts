import fsp from 'node:fs/promises';
import path from 'node:path';

function resolveScoped(appId: string, rel: string) {
  const root = path.resolve(path.join(process.cwd(), 'data', appId));
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep) && abs !== root) throw new Error('Path escapes app storage root');
  return abs;
}

export async function storageWriteText(appId: string, rel: string, content: string) {
  const abs = resolveScoped(appId, rel);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, content, 'utf8');
}

export async function storageWriteBuffer(appId: string, rel: string, buf: Uint8Array) {
  const abs = resolveScoped(appId, rel);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, buf);
}

export async function storageReadText(appId: string, rel: string) {
  const abs = resolveScoped(appId, rel);
  return await fsp.readFile(abs, 'utf8');
}
