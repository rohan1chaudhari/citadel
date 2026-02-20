import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import path from 'path';
import { appDataRoot } from '@/lib/paths';

export const runtime = 'nodejs';
const APP_ID = 'friend-tracker';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    
    if (!file) {
      return NextResponse.json({ ok: false, error: 'No image provided' }, { status: 400 });
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'File must be an image' }, { status: 400 });
    }
    
    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const filename = `meeting_${timestamp}_${random}.${ext}`;
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(appDataRoot(APP_ID), 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    
    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);
    
    // Return relative path
    return NextResponse.json({ 
      ok: true, 
      path: `/api/apps/friend-tracker/uploads/${filename}` 
    });
  } catch (err: any) {
    return NextResponse.json({ 
      ok: false, 
      error: err?.message || 'Upload failed' 
    }, { status: 500 });
  }
}
