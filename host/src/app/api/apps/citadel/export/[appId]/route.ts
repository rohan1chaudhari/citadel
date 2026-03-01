import { NextResponse } from 'next/server';
import { appDbPath, appDataRoot } from '@citadel/core';
import { audit } from '@citadel/core';
import { listApps } from '@citadel/core';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';

// Simple PKZip implementation for creating zip files
// This creates a valid ZIP file without external dependencies
class SimpleZip {
  private entries: { name: string; data: Uint8Array }[] = [];

  addFile(name: string, data: Uint8Array) {
    this.entries.push({ name, data });
  }

  async toBuffer(): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const centralDirectory: { name: string; offset: number; size: number; crc: number }[] = [];
    let offset = 0;

    // Helper to calculate CRC32
    const crcTable = this.makeCrcTable();
    const crc32 = (data: Uint8Array): number => {
      let crc = 0xffffffff;
      for (const byte of data) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };

    // Local file headers and data
    for (const entry of this.entries) {
      const nameBytes = Buffer.from(entry.name, 'utf8');
      const compressedData = entry.data; // Store uncompressed for simplicity
      const uncompressedSize = entry.data.length;
      const crc = crc32(entry.data);

      // Local file header
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0); // Signature
      localHeader.writeUInt16LE(20, 4); // Version needed
      localHeader.writeUInt16LE(0, 6); // General purpose bit flag
      localHeader.writeUInt16LE(0, 8); // Compression method (0 = stored)
      localHeader.writeUInt16LE(0, 10); // File last modification time
      localHeader.writeUInt16LE(0, 12); // File last modification date
      localHeader.writeUInt32LE(crc, 14); // CRC-32
      localHeader.writeUInt32LE(compressedData.length, 18); // Compressed size
      localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
      localHeader.writeUInt16LE(nameBytes.length, 26); // File name length
      localHeader.writeUInt16LE(0, 28); // Extra field length

      chunks.push(localHeader);
      chunks.push(nameBytes);
      chunks.push(Buffer.from(compressedData));

      centralDirectory.push({
        name: entry.name,
        offset,
        size: compressedData.length,
        crc,
      });

      offset += localHeader.length + nameBytes.length + compressedData.length;
    }

    // Central directory
    const cdStart = offset;
    for (const entry of centralDirectory) {
      const nameBytes = Buffer.from(entry.name, 'utf8');
      const cdHeader = Buffer.alloc(46);
      cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
      cdHeader.writeUInt16LE(20, 4); // Version made by
      cdHeader.writeUInt16LE(20, 6); // Version needed
      cdHeader.writeUInt16LE(0, 8); // General purpose bit flag
      cdHeader.writeUInt16LE(0, 10); // Compression method
      cdHeader.writeUInt16LE(0, 12); // File last modification time
      cdHeader.writeUInt16LE(0, 14); // File last modification date
      cdHeader.writeUInt32LE(entry.crc, 16); // CRC-32
      cdHeader.writeUInt32LE(entry.size, 20); // Compressed size
      cdHeader.writeUInt32LE(entry.size, 24); // Uncompressed size
      cdHeader.writeUInt16LE(nameBytes.length, 28); // File name length
      cdHeader.writeUInt16LE(0, 30); // Extra field length
      cdHeader.writeUInt16LE(0, 32); // File comment length
      cdHeader.writeUInt16LE(0, 34); // Disk number start
      cdHeader.writeUInt16LE(0, 36); // Internal file attributes
      cdHeader.writeUInt32LE(0, 38); // External file attributes
      cdHeader.writeUInt32LE(entry.offset, 42); // Relative offset

      chunks.push(cdHeader);
      chunks.push(nameBytes);
      offset += cdHeader.length + nameBytes.length;
    }

    // End of central directory record
    const cdSize = offset - cdStart;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // Signature
    eocd.writeUInt16LE(0, 4); // Number of this disk
    eocd.writeUInt16LE(0, 6); // Disk with central directory
    eocd.writeUInt16LE(centralDirectory.length, 8); // Number of entries on this disk
    eocd.writeUInt16LE(centralDirectory.length, 10); // Total number of entries
    eocd.writeUInt32LE(cdSize, 12); // Size of central directory
    eocd.writeUInt32LE(cdStart, 16); // Offset of start of central directory
    eocd.writeUInt16LE(0, 20); // Comment length

    chunks.push(eocd);

    return Buffer.concat(chunks);
  }

  private makeCrcTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    return table;
  }
}

// Helper to format timestamp for filename (ISO with hyphens instead of colons)
function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

// Recursively collect all files in a directory
async function* walkDir(dirPath: string, prefix: string): AsyncGenerator<{ name: string; fullPath: string }> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      yield* walkDir(fullPath, zipPath);
    } else {
      yield { name: zipPath, fullPath };
    }
  }
}

export async function GET(
  _req: Request,
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

  const dbPath = appDbPath(appId);
  const storageRoot = appDataRoot(appId);
  const timestamp = new Date();
  const filename = `${appId}-${formatTimestamp(timestamp)}.zip`;

  try {
    const zip = new SimpleZip();
    let totalBytes = 0;

    // Add DB file if it exists
    try {
      await fs.promises.access(dbPath);
      const dbData = await fsp.readFile(dbPath);
      zip.addFile('db.sqlite', new Uint8Array(dbData));
      totalBytes += dbData.length;
    } catch {
      // DB doesn't exist, skip it
    }

    // Add storage files if directory exists
    try {
      const storageStats = await fsp.stat(storageRoot);
      if (storageStats.isDirectory()) {
        for await (const file of walkDir(storageRoot, 'storage')) {
          const data = await fsp.readFile(file.fullPath);
          zip.addFile(file.name, new Uint8Array(data));
          totalBytes += data.length;
        }
      }
    } catch {
      // Storage directory doesn't exist, skip it
    }

    // Generate the zip buffer
    const zipBuffer = await zip.toBuffer();

    audit('citadel', 'app.export', { appId, filename, bytes: totalBytes });

    // Return the zip file (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error: any) {
    audit('citadel', 'app.export.error', { appId, error: error?.message });
    return NextResponse.json(
      { ok: false, error: 'Export failed', details: error?.message },
      { status: 500 }
    );
  }
}
