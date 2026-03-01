import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@citadel/core';
import { checkAiPermission } from '@/lib/aiPermission';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function callAI(userMessage: string, history: string[]): Promise<string> {
  const key = requireEnv('OPENAI_API_KEY');

  const systemPrompt = `You are a helpful assistant. Be concise and clear in your responses.

Context: This is a chat in a personal app platform called Citadel.
Keep responses friendly and helpful. If you don't know something, say so.`;

  // Build message history
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add recent history (last 10 messages)
  for (let i = 0; i < history.length; i += 2) {
    messages.push({ role: 'user', content: history[i] });
    if (history[i + 1]) {
      messages.push({ role: 'assistant', content: history[i + 1] });
    }
  }

  messages.push({ role: 'user', content: userMessage });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`AI API failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('AI API: missing content in response');
  }

  return content;
}

export async function POST(req: Request) {
  // Check AI permission first
  const permissionError = checkAiPermission(APP_ID, '/api/apps/{{app_id}}/chat');
  if (permissionError) return permissionError;

  try {
    const body = await req.json().catch(() => ({} as any));
    const message = String(body?.message ?? '').trim();

    if (!message) {
      return NextResponse.json(
        { ok: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Get recent history for context
    const historyRows = dbQuery<{ role: string; content: string }>(
      APP_ID,
      `SELECT role, content FROM messages 
       ORDER BY created_at ASC 
       LIMIT 20`
    );

    const history: string[] = [];
    for (const row of historyRows) {
      history.push(row.content);
    }

    // Save user message
    dbExec(
      APP_ID,
      'INSERT INTO messages (role, content, created_at) VALUES (?, ?, ?)',
      ['user', message, new Date().toISOString()]
    );

    // Call AI
    const aiResponse = await callAI(message, history);

    // Save AI response
    dbExec(
      APP_ID,
      'INSERT INTO messages (role, content, created_at) VALUES (?, ?, ?)',
      ['assistant', aiResponse, new Date().toISOString()]
    );

    return NextResponse.json({
      ok: true,
      response: aiResponse,
    });
  } catch (e: any) {
    console.error('Chat error:', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
