import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

const KB_DIR = '/home/rohanchaudhari/personal/citadel/kb';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getAppKb(appId: string): Promise<string | null> {
  // Try different KB file patterns
  const possiblePaths = [
    join(KB_DIR, `ROADMAP-${appId}.md`),
    join(KB_DIR, `${appId}.md`),
    join(KB_DIR, appId, 'README.md'),
    join(KB_DIR, appId, 'index.md'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        const content = await readFile(path, 'utf-8');
        return content.slice(0, 8000); // Limit KB context size
      } catch {
        // Continue to next path
      }
    }
  }

  // Try to read any .md files in app-specific kb folder
  const appKbDir = join(KB_DIR, appId);
  if (existsSync(appKbDir)) {
    // We'll just return null for now as reading directories is more complex
    // and the roadmap file is the primary source
  }

  return null;
}

async function generateTaskDetails(title: string, appId: string, kbContext: string | null) {
  const key = requireEnv('OPENAI_API_KEY');

  const systemPrompt = `You are a helpful assistant that creates clear, actionable task descriptions and acceptance criteria for software development tasks.

Given a task title and optional app context, generate:
1. A concise but informative description explaining what the task is about
2. Concrete acceptance criteria that clearly define when the task is complete

Format your response as JSON with this exact structure:
{
  "description": "string (plain text, can be multi-sentence)",
  "acceptanceCriteria": "string (bullet points using - or numbers)"
}

Guidelines:
- Description should be 1-3 sentences explaining the purpose
- Acceptance criteria should be specific, measurable, and testable
- Use plain language, avoid technical jargon unless necessary
- Focus on user outcomes and deliverables`;

  const userPrompt = `App: ${appId}
Task Title: ${title}

${kbContext ? `App Context (from KB):\n${kbContext}\n\n` : ''}Generate a description and acceptance criteria for this task.`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      text: {
        format: {
          type: 'json_schema',
          name: 'task_details',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              description: {
                type: 'string',
                description: 'A concise description of the task',
              },
              acceptanceCriteria: {
                type: 'string',
                description: 'Specific acceptance criteria for completing the task',
              },
            },
            required: ['description', 'acceptanceCriteria'],
          },
        },
      },
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`LLM generation failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const text =
    data?.output?.[0]?.content?.[0]?.text ??
    data?.output_text ??
    '';

  if (!text) {
    throw new Error('Empty response from LLM');
  }

  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {}
    }
    throw new Error('Failed to parse LLM response as JSON');
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const title = String(body?.title ?? '').trim();
    const appId = String(body?.appId ?? '').trim();

    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'title required' },
        { status: 400 }
      );
    }

    if (!appId) {
      return NextResponse.json(
        { ok: false, error: 'appId required' },
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

    // Get app-level KB context if available
    const kbContext = await getAppKb(appId);

    // Generate task details
    const result = await generateTaskDetails(title, appId, kbContext);

    return NextResponse.json({
      ok: true,
      description: result.description,
      acceptanceCriteria: result.acceptanceCriteria,
      hasKbContext: kbContext !== null,
    });
  } catch (e: any) {
    console.error('AI generate error:', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
