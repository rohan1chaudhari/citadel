import { NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { appDataRoot } from '@/lib/paths';

export const runtime = 'nodejs';
const APP_ID = 'friend-tracker';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  
  // Security: prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }
  
  const filePath = path.join(appDataRoot(APP_ID), 'uploads', filename);
  
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }
    
    const stream = createReadStream(filePath);
    
    // Guess content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' 
      : ext === '.gif' ? 'image/gif'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg';
    
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
