import fs from 'node:fs/promises';
import path from 'node:path';

function fullPath(appId: string, relPath: string) {
  return path.join(process.cwd(), 'data', appId, relPath);
}

export async function storageWriteText(appId: string, relPath: string, content: string) {
  const out = fullPath(appId, relPath);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, content, 'utf8');
}

export async function storageReadText(appId: string, relPath: string) {
  const p = fullPath(appId, relPath);
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}
