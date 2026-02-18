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

async function transcribeElevenLabs(audio: File, opts?: { languageCode?: string }) {
  const key = requireEnv('ELEVENLABS_API_KEY');

  const fd = new FormData();
  fd.set('model_id', 'scribe_v1');
  fd.set('file', audio);
  // Force English unless overridden.
  fd.set('language_code', opts?.languageCode ?? 'en');
  // Keep it simple for journaling.
  fd.set('diarize', 'false');
  fd.set('tag_audio_events', 'false');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': key
    },
    body: fd
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`ElevenLabs STT failed (${res.status}): ${JSON.stringify(data)}`);
  }

  // ElevenLabs returns either `text` or `transcript` depending on API version.
  const text = (data?.text ?? data?.transcript ?? data?.transcription) as unknown;
  if (typeof text !== 'string') throw new Error(`ElevenLabs STT: missing transcript text (${JSON.stringify(data)})`);
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

    const transcript = await transcribeElevenLabs(audio, { languageCode: 'en' });

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
