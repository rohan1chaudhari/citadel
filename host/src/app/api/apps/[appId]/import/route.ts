import { NextResponse } from 'next/server';
import { appDbPath, appDataRoot, dataRoot } from '@/lib/paths';
import { audit } from '@/lib/audit';
import { listApps } from '@/lib/registry';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';

// Simple PKZip parser for reading zip files
// Only supports stored (uncompressed) files
class SimpleZipReader {
  private buffer: Buffer;
  private entries: Map<string, { data: Uint8Array; offset: number; size: number }> = new Map();

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.parse();
  }

  private parse() {
    // Find end of central directory record
    const eocdOffset = this.findEOCD();
    if (eocdOffset === -1) {
      throw new Error('Invalid zip file: EOCD not found');
    }

    // Read central directory info
    const cdEntries = this.buffer.readUInt16LE(eocdOffset + 8);
    const cdSize = this.buffer.readUInt32LE(eocdOffset + 12);
    const cdOffset = this.buffer.readUInt32LE(eocdOffset + 16);

    // Parse central directory entries
    let offset = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
      const signature = this.buffer.readUInt32LE(offset);
      if (signature !== 0x02014b50) {
        throw new Error(`Invalid central directory signature at offset ${offset}`);
      }

      const compressionMethod = this.buffer.readUInt16LE(offset + 10);
      const compressedSize = this.buffer.readUInt32LE(offset + 20);
      const uncompressedSize = this.buffer.readUInt32LE(offset + 24);
      const nameLength = this.buffer.readUInt16LE(offset + 28);
      const extraLength = this.buffer.readUInt16LE(offset + 30);
      const commentLength = this.buffer.readUInt16LE(offset + 32);
      const localHeaderOffset = this.buffer.readUInt32LE(offset + 42);

      const name = this.buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

      if (compressionMethod !== 0) {
        throw new Error(`Unsupported compression method ${compressionMethod} for file ${name}`);
      }

      // Read the local header to find the actual data offset
      const localNameLength = this.buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = this.buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;

      const data = new Uint8Array(this.buffer.buffer, this.buffer.byteOffset + dataOffset, compressedSize);
      this.entries.set(name, { data, offset: dataOffset, size: compressedSize });

      offset += 46 + nameLength + extraLength + commentLength;
    }
  }

  private findEOCD(): number {
    // Search backwards from end of file for EOCD signature
    for (let i = this.buffer.length - 22; i >= 0; i--) {
      if (this.buffer.readUInt32LE(i) === 0x06054b50) {
        return i;
      }
    }
    return -1;
  }

  hasFile(name: string): boolean {
    return this.entries.has(name);
  }

  getFile(name: string): Uint8Array | null {
    const entry = this.entries.get(name);
    return entry ? entry.data : null;
  }

  listFiles(): string[] {
    return Array.from(this.entries.keys());
  }

  getStorageFiles(): { name: string; data: Uint8Array }[] {
    const files: { name: string; data: Uint8Array }[] = [];
    for (const [name, entry] of this.entries) {
      if (name.startsWith('storage/')) {
        files.push({ name: name.slice(8), data: entry.data }); // Remove 'storage/' prefix
      }
    }
    return files;
  }
}

// Format timestamp for backup directory
function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

// Backup current app data
async function backupAppData(appId: string): Promise<string> {
  const dbPath = appDbPath(appId);
  const storageRoot = appDataRoot(appId);
  const timestamp = formatTimestamp(new Date());
  const backupDir = path.join(dataRoot(), 'backups', appId, timestamp);

  await fsp.mkdir(backupDir, { recursive: true });

  // Backup DB file if it exists
  try {
    await fs.promises.access(dbPath);
    await fsp.copyFile(dbPath, path.join(backupDir, 'db.sqlite'));
  } catch {
    // DB doesn't exist, skip
  }

  // Backup storage files if they exist
  try {
    const storageStats = await fsp.stat(storageRoot);
    if (storageStats.isDirectory()) {
      const backupStorageDir = path.join(backupDir, 'storage');
      await fsp.mkdir(backupStorageDir, { recursive: true });

      async function copyDir(src: string, dest: string) {
        const entries = await fsp.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            await fsp.mkdir(destPath, { recursive: true });
            await copyDir(srcPath, destPath);
          } else {
            await fsp.copyFile(srcPath, destPath);
          }
        }
      }

      await copyDir(storageRoot, backupStorageDir);
    }
  } catch {
    // Storage directory doesn't exist, skip
  }

  return backupDir;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  if (!appId) {
    return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
  }

  // Verify the app exists
  const apps = await listApps(true);
  const app = apps.find(a => a.id === appId);
  if (!app) {
    return NextResponse.json({ ok: false, error: 'app not found' }, { status: 404 });
  }

  try {
    // Read the uploaded zip file
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/zip') && !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { ok: false, error: 'Expected zip file upload' },
        { status: 400 }
      );
    }

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Empty file uploaded' },
        { status: 400 }
      );
    }

    // Parse the zip file
    let zip: SimpleZipReader;
    try {
      zip = new SimpleZipReader(buffer);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: 'Invalid zip file', details: e?.message },
        { status: 400 }
      );
    }

    // Validate zip structure - must contain db.sqlite
    if (!zip.hasFile('db.sqlite')) {
      return NextResponse.json(
        { ok: false, error: 'Invalid backup: db.sqlite not found in zip' },
        { status: 400 }
      );
    }

    const dbPath = appDbPath(appId);
    const storageRoot = appDataRoot(appId);

    // Backup current data before overwriting
    let backupPath: string | null = null;
    try {
      const currentDbExists = await fsp.access(dbPath).then(() => true).catch(() => false);
      const currentStorageExists = await fsp.stat(storageRoot).then(s => s.isDirectory()).catch(() => false);

      if (currentDbExists || currentStorageExists) {
        backupPath = await backupAppData(appId);
      }
    } catch (e: any) {
      console.error('Backup failed:', e);
      return NextResponse.json(
        { ok: false, error: 'Failed to create backup before import', details: e?.message },
        { status: 500 }
      );
    }

    // Clear the cached DB connection (invalidate it)
    // We need to reimport the db module to clear the cache
    // Since we can't easily clear the module cache, we'll just overwrite the file
    // and the next db access will create a new connection

    // Ensure the app data directory exists
    await fsp.mkdir(appDataRoot(appId), { recursive: true });

    // Extract db.sqlite
    const dbData = zip.getFile('db.sqlite');
    if (dbData) {
      await fsp.writeFile(dbPath, dbData);
    }

    // Extract storage files
    const storageFiles = zip.getStorageFiles();
    if (storageFiles.length > 0) {
      // Clear existing storage (except db.sqlite which we just wrote)
      try {
        const entries = await fsp.readdir(appDataRoot(appId), { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name !== 'db.sqlite') {
            const entryPath = path.join(appDataRoot(appId), entry.name);
            if (entry.isDirectory()) {
              await fsp.rm(entryPath, { recursive: true });
            } else {
              await fsp.unlink(entryPath);
            }
          }
        }
      } catch {
        // Directory might be empty
      }

      // Write storage files
      for (const file of storageFiles) {
        const filePath = path.join(storageRoot, file.name);
        await fsp.mkdir(path.dirname(filePath), { recursive: true });
        await fsp.writeFile(filePath, file.data);
      }
    }

    // Import complete - log the event
    audit('citadel', 'app.import', {
      appId,
      backupPath,
      filesRestored: ['db.sqlite', ...storageFiles.map(f => f.name)],
    });

    return NextResponse.json({
      ok: true,
      message: `Import successful for ${appId}`,
      backupPath: backupPath ? path.relative(dataRoot(), backupPath) : null,
      filesRestored: 1 + storageFiles.length, // db.sqlite + storage files
    });

  } catch (error: any) {
    audit('citadel', 'app.import.error', { appId, error: error?.message });
    return NextResponse.json(
      { ok: false, error: 'Import failed', details: error?.message },
      { status: 500 }
    );
  }
}
