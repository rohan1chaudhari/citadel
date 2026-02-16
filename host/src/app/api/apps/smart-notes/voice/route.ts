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

function containsCJK(s: string) {
  // Rough check for Japanese/Chinese/Korean characters.
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(s);
}

async function transcribeOpenAI(audio: File, opts?: { language?: string; prompt?: string }) {
  const key = requireEnv('OPENAI_API_KEY');

  const fd = new FormData();
  fd.set('model', 'gpt-4o-transcribe');
  fd.set('file', audio);

  // Force English unless explicitly overridden.
  const language = opts?.language ?? 'en';
  if (language) fd.set('language', language);

  // Nudge: transcribe, don't translate.
  const prompt =
    opts?.prompt ??
    'Transcribe the audio verbatim in English. Do not translate or switch languages. If unclear, write [inaudible].';
  fd.set('prompt', prompt);

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

function formatMarkdownFromTranscript(raw: string) {
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\s([,.!?;:])/g, '$1')
    .trim();

  return {
    markdown: `## Clean transcript\n\n${cleaned || '_No transcript._'}\n\n## Raw transcript\n\n> ${raw.trim().split(/\r?\n/).join('\n> ')}\n`
  };
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

    // Transcribe (force English). If we still get CJK characters, retry once with a stricter prompt.
    let transcript = await transcribeOpenAI(audio, { language: 'en' });
    if (containsCJK(transcript)) {
      transcript = await transcribeOpenAI(audio, {
        language: 'en',
        prompt: 'Transcribe strictly in English characters. Do not output Japanese/Chinese/Korean. If uncertain, output [inaudible].'
      });
    }

    const { markdown } = formatMarkdownFromTranscript(transcript);
    const title = `Voice note — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

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
