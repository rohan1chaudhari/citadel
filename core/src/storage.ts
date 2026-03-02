import fsp from 'node:fs/promises';
import path from 'node:path';
import { assertAppId } from './appIds.js';
import { appDataRoot } from './paths.js';
import { audit } from './audit.js';
import { hasStoragePermission } from './permissions.js';
import { checkWriteQuota, formatBytes } from './quota.js';

function resolveScoped(appId: string, rel: string) {
  assertAppId(appId);
  const root = path.resolve(appDataRoot(appId));
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error('Path escapes app storage root');
  }
  return abs;
}

function checkQuotaBeforeWrite(appId: string, bytes: number, operation: string, path: string) {
  const quotaCheck = checkWriteQuota(appId, bytes);
  
  if (!quotaCheck.allowed) {
    const error = `Storage quota exceeded for app '${appId}': would use ${formatBytes(quotaCheck.wouldUseBytes)} of ${formatBytes(quotaCheck.quotaBytes)}`;
    audit(appId, `storage.${operation}.quota_exceeded`, { 
      path, 
      bytes, 
      used: quotaCheck.usedBytes,
      quota: quotaCheck.quotaBytes,
      would_use: quotaCheck.wouldUseBytes
    });
    const err = new Error(error);
    (err as any).code = 'QUOTA_EXCEEDED';
    (err as any).statusCode = 507; // Insufficient Storage
    throw err;
  }
}

export async function storageWriteText(appId: string, rel: string, content: string) {
  if (!hasStoragePermission(appId, 'write')) {
    const error = `Permission denied: app '${appId}' does not have storage.write permission`;
    audit(appId, 'storage.write.denied', { path: rel, error });
    throw new Error(error);
  }
  
  const bytes = Buffer.byteLength(content, 'utf8');
  checkQuotaBeforeWrite(appId, bytes, 'write', rel);
  
  const abs = resolveScoped(appId, rel);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, content, 'utf8');
  audit(appId, 'storage.write', { path: rel, bytes });
}

export async function storageWriteBuffer(appId: string, rel: string, buf: Uint8Array) {
  if (!hasStoragePermission(appId, 'write')) {
    const error = `Permission denied: app '${appId}' does not have storage.write permission`;
    audit(appId, 'storage.write.denied', { path: rel, error });
    throw new Error(error);
  }
  
  checkQuotaBeforeWrite(appId, buf.byteLength, 'write', rel);
  
  const abs = resolveScoped(appId, rel);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, buf);
  audit(appId, 'storage.write', { path: rel, bytes: buf.byteLength });
}

export async function storageReadText(appId: string, rel: string) {
  if (!hasStoragePermission(appId, 'read')) {
    const error = `Permission denied: app '${appId}' does not have storage.read permission`;
    audit(appId, 'storage.read.denied', { path: rel, error });
    throw new Error(error);
  }
  
  const abs = resolveScoped(appId, rel);
  const text = await fsp.readFile(abs, 'utf8');
  audit(appId, 'storage.read', { path: rel, bytes: Buffer.byteLength(text, 'utf8') });
  return text;
}
