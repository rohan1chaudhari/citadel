import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { storageWriteBuffer } from '@/lib/storage';
import { audit } from '@/lib/audit';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';

export const runtime = 'nodejs';

const APP_ID = 'smart-notes';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function ensureSchema() {
  ensureSmartNotesSchema();
}

async function processImageWithVision(image: File) {
  const key = requireEnv('OPENAI_API_KEY');
  
  // Convert image to base64
  const bytes = new Uint8Array(await image.arrayBuffer());
  const base64 = Buffer.from(bytes).toString('base64');
  const mimeType = image.type || 'image/jpeg';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: `You are a handwriting/note transcription assistant. 
Extract all text from the image and convert it to clean, structured Markdown.

Guidelines:
- Convert to-do lists to proper Markdown: "- [ ] task" or "- [x] done"
- Convert schedules/times to structured lists with times
- Use headings only for major sections, not for every line
- Remove filler words, arrows (→), and noise
- Clean up formatting - no + or random bullet points
- Group related items together logically
- If handwriting is unclear, mark with [unclear]
- Output ONLY clean markdown, no explanatory text

Example good output:
## Friday Schedule

- 12:00 - 13:30: Gym
- 13:30 - 15:00: Lunch
- 15:00 - 16:00: Passport collection & print docs

## Tasks
- [ ] Fold clothes
- [x] Eat`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract and structure this handwritten note:' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      max_completion_tokens: 4000
    })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Vision API failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Vision API: missing content in response');
  }

  return content;
}

export async function POST(req: Request) {
  try {
    ensureSchema();

    const form = await req.formData();
    const image = form.get('image');
    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: 'missing image file (field: image)' }, { status: 400 });
    }

    // Validate image type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!validTypes.includes(image.type)) {
      return NextResponse.json({ 
        ok: false, 
        error: `Invalid image type: ${image.type}. Supported: ${validTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Save raw image
    const ext = (image.name.split('.').pop() || 'jpg').toLowerCase();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const relPath = `photos/${ts}.${ext}`;
    const buf = new Uint8Array(await image.arrayBuffer());
    await storageWriteBuffer(APP_ID, relPath, buf);

    audit(APP_ID, 'photo.upload', { path: relPath, bytes: buf.byteLength, type: image.type });

    // Process with Vision + LLM
    const markdown = await processImageWithVision(image);

    // Extract title from first line or generate
    const firstLine = markdown.split('\n')[0].replace(/^#+\s*/, '').trim();
    const title = firstLine.slice(0, 100) || `Photo note — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

    // Wrap with metadata (just captured timestamp, no header)
    const fullBody = `${markdown}\n\n---\n*Captured: ${new Date().toLocaleString()}*`;

    dbExec(APP_ID, `INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)`, [
      title,
      fullBody,
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    const idRow = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0];
    const id = idRow?.id;

    audit(APP_ID, 'photo.note_created', { id, path: relPath, chars: markdown.length });

    return NextResponse.json({ ok: true, id, title, imagePath: relPath, preview: markdown.slice(0, 200) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
