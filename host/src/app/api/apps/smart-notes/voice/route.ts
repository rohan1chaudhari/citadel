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
    title: `Voice note — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    markdown: cleaned || '_No transcript._'
  };
}

async function structureVoiceNoteWithLlm(transcript: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return formatMarkdownFromTranscript(transcript);

  const prompt = [
    'Turn this voice transcript into a clean, readable markdown note.',
    'Return strict JSON only with keys: title, markdown.',
    'Rules:',
    '- Do NOT include headings like "Clean transcript" or "Raw transcript".',
    '- Keep meaning faithful; do not invent facts.',
    '- Use concise markdown structure (short paragraphs, bullets/checklist) when helpful.',
    '- If content is short, a plain paragraph is fine.',
    `Transcript: ${transcript}`
  ].join('\n');

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      text: {
        format: {
          type: 'json_schema',
          name: 'smart_note_voice_format',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              markdown: { type: 'string' }
            },
            required: ['title', 'markdown']
          }
        }
      },
      input: prompt
    })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) return formatMarkdownFromTranscript(transcript);

  const candidate = data?.output?.[0]?.content?.[0]?.text ?? data?.output_text ?? '';
  const text = String(candidate).trim();
  if (!text) return formatMarkdownFromTranscript(transcript);

  try {
    const parsed = JSON.parse(text);
    const title = typeof parsed?.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : `Voice note — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    const markdown = typeof parsed?.markdown === 'string' && parsed.markdown.trim()
      ? parsed.markdown.trim()
      : formatMarkdownFromTranscript(transcript).markdown;
    return { title, markdown };
  } catch {
    return formatMarkdownFromTranscript(transcript);
  }
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

    const { title, markdown } = await structureVoiceNoteWithLlm(transcript);

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
