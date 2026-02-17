import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function transcribeElevenLabs(audio: File) {
  const key = requireEnv('ELEVENLABS_API_KEY');

  const fd = new FormData();
  fd.set('model_id', 'scribe_v1');
  fd.set('file', audio);
  fd.set('language_code', 'en');
  fd.set('diarize', 'false');
  fd.set('tag_audio_events', 'false');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: fd
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`ElevenLabs STT failed (${res.status}): ${JSON.stringify(data)}`);

  const text = (data?.text ?? data?.transcript ?? data?.transcription) as unknown;
  if (typeof text !== 'string') throw new Error('STT transcript missing');
  return text.trim();
}

async function extractWithLlm(transcript: string, context: Record<string, unknown>) {
  const key = requireEnv('OPENAI_API_KEY');
  const prompt = [
    'Extract gym set fields from transcript.',
    'Return ONLY strict JSON with keys: exercise, set, weight, reps, category, confidence, missingFields.',
    'exercise/category are strings or null. set/weight/reps are numbers or null. confidence is 0..1. missingFields is string[].',
    'If user says same/again, infer using provided context.',
    `Context: ${JSON.stringify(context)}`,
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
      temperature: 0,
      input: prompt
    })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`LLM extraction failed (${res.status}): ${JSON.stringify(data)}`);

  const text = String(data?.output_text ?? '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('LLM did not return JSON');

  const parsed = JSON.parse(text.slice(start, end + 1));
  return {
    exercise: typeof parsed?.exercise === 'string' ? parsed.exercise : null,
    set: Number.isFinite(Number(parsed?.set)) ? Number(parsed.set) : null,
    weight: Number.isFinite(Number(parsed?.weight)) ? Number(parsed.weight) : null,
    reps: Number.isFinite(Number(parsed?.reps)) ? Number(parsed.reps) : null,
    category: typeof parsed?.category === 'string' ? parsed.category : null,
    confidence: Number.isFinite(Number(parsed?.confidence)) ? Number(parsed.confidence) : 0,
    missingFields: Array.isArray(parsed?.missingFields) ? parsed.missingFields.map((x: unknown) => String(x)) : []
  };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ ok: false, error: 'missing audio file (field: audio)' }, { status: 400 });
    }

    const contextRaw = String(form.get('context') ?? '{}');
    let context: Record<string, unknown> = {};
    try { context = JSON.parse(contextRaw); } catch {}

    const transcript = await transcribeElevenLabs(audio);
    const extracted = await extractWithLlm(transcript, context);

    return NextResponse.json({ ok: true, transcript, extracted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
