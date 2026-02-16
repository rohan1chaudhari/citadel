import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { storageWriteBuffer } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

const APP_ID = 'smart-notes';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      created_at TEXT NOT NULL
    )`
  );
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN updated_at TEXT`);
  } catch {}
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN deleted_at TEXT`);
  } catch {}
}

async function transcribeOpenAI(audio: File) {
  const key = requireEnv('OPENAI_API_KEY');

  const fd = new FormData();
  fd.set('model', 'gpt-4o-mini-transcribe');
  fd.set('file', audio);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`OpenAI transcribe failed (${res.status}): ${JSON.stringify(data)}`);
  }
  const text = data?.text;
  if (typeof text !== 'string') throw new Error('OpenAI transcribe: missing text');
  return text;
}

async function structureWithOpenAI(transcript: string) {
  const key = requireEnv('OPENAI_API_KEY');

  const prompt = `You are a note-taking assistant. Turn the transcript into a clean personal note in Markdown.

Requirements:
- Output JSON ONLY with keys: title, markdown
- title: short and specific
- markdown: should include sections:
  - Summary (3-6 bullets)
  - Key points (bullets)
  - Actions (checkbox list, can be empty)
  - Raw transcript (verbatim transcript in a blockquote)
- Keep it concise.

Transcript:\n${transcript}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You produce clean structured notes as strict JSON.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenAI structure failed (${res.status}): ${JSON.stringify(data)}`);

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('OpenAI structure: missing content');

  let obj: any;
  try {
    obj = JSON.parse(content);
  } catch {
    throw new Error(`OpenAI structure: invalid JSON: ${content}`);
  }
  const title = typeof obj.title === 'string' ? obj.title.slice(0, 200) : 'Voice note';
  const markdown = typeof obj.markdown === 'string' ? obj.markdown : transcript;
  return { title, markdown };
}

export async function POST(req: Request) {
  try {
    ensureSchema();

    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ ok: false, error: 'missing audio file (field: audio)' }, { status: 400 });
    }

    // Save raw audio
    const ext = (audio.name.split('.').pop() || 'webm').toLowerCase();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const relPath = `voice/${ts}.${ext}`;
    const buf = new Uint8Array(await audio.arrayBuffer());
    await storageWriteBuffer(APP_ID, relPath, buf);

    audit(APP_ID, 'voice.upload', { path: relPath, bytes: buf.byteLength, type: audio.type });

    const transcript = await transcribeOpenAI(audio);
    const { title, markdown } = await structureWithOpenAI(transcript);

    dbExec(APP_ID, `INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)`, [
      title,
      markdown,
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    const idRow = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0];
    const id = idRow?.id;

    audit(APP_ID, 'voice.note_created', { id, path: relPath, transcriptChars: transcript.length });

    return NextResponse.json({ ok: true, id, title, audioPath: relPath });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
