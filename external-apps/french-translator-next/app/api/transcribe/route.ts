import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    if (!audioFile) return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });

    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, 'audio.webm');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'fr');

    const prompt = formData.get('prompt') as string;
    if (prompt) whisperForm.append('prompt', prompt);

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm
    });

    if (!res.ok) return NextResponse.json({ error: `Whisper API error: ${await res.text()}` }, { status: 500 });
    const data = await res.json();
    return NextResponse.json({ text: data.text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Transcription failed' }, { status: 500 });
  }
}
