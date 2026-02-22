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
        return content.slice(0, 10000);
      } catch {
        // Continue to next path
      }
    }
  }

  return null;
}

async function generateVisionAndTasks(appId: string, kbContext: string | null) {
  const key = requireEnv('OPENAI_API_KEY');

  const systemPrompt = `You are a product strategist AI that helps define app visions and break them down into actionable tasks.

Given an app identifier and optional context, generate:
1. A compelling vision statement that describes what the app should become
2. 3-7 concrete tasks that would help achieve this vision

Each task should be:
- Specific and actionable
- Independent (can be worked on separately)
- Small enough to be completed in one session
- Clearly named with a concise title

Format your response as JSON with this exact structure:
{
  "vision": "string - A 1-2 sentence vision statement describing the app's purpose and goals",
  "tasks": [
    {
      "title": "string - Concise task title",
      "description": "string - Brief description of what this task involves",
      "acceptanceCriteria": "string - Bullet points defining completion"
    }
  ]
}

Guidelines:
- Vision should be inspiring but grounded in reality
- Tasks should cover the most important aspects of the vision
- Include a mix of foundational setup and feature work
- Tasks should be in logical order of implementation`;

  const userPrompt = `App ID: ${appId}

${kbContext ? `Existing App Context:\n${kbContext}\n\n` : ''}Generate a vision statement and proposed tasks for this app.`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      text: {
        format: {
          type: 'json_schema',
          name: 'vision_suggestion',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              vision: {
                type: 'string',
                description: 'A compelling 1-2 sentence vision statement for the app',
              },
              tasks: {
                type: 'array',
                description: 'List of proposed tasks to achieve the vision',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    title: {
                      type: 'string',
                      description: 'Concise task title',
                    },
                    description: {
                      type: 'string',
                      description: 'Brief description of the task',
                    },
                    acceptanceCriteria: {
                      type: 'string',
                      description: 'Bullet points defining task completion',
                    },
                  },
                  required: ['title', 'description', 'acceptanceCriteria'],
                },
              },
            },
            required: ['vision', 'tasks'],
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
    const appId = String(body?.appId ?? '').trim();

    if (!appId) {
      return NextResponse.json(
        { ok: false, error: 'appId required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const kbContext = await getAppKb(appId);
    const result = await generateVisionAndTasks(appId, kbContext);

    return NextResponse.json({
      ok: true,
      vision: result.vision,
      tasks: result.tasks,
      hasKbContext: kbContext !== null,
    });
  } catch (e: any) {
    console.error('Vision suggest error:', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
