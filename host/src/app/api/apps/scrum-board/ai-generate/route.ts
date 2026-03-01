import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { checkAiPermission } from '@/lib/aiPermission';
import { 
  llmRequest, 
  checkLLMConfig, 
  parseLLMJSON,
  LLMError 
} from '@/lib/llmProvider';

export const runtime = 'nodejs';

const APP_ID = 'scrum-board';
const KB_DIR = '/home/rohanchaudhari/personal/citadel/kb';

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

  return null;
}

async function generateTaskDetails(title: string, appId: string, kbContext: string | null) {
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

  const response = await llmRequest({
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    jsonSchema: {
      name: 'task_details',
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
  });

  return parseLLMJSON(response.text) as {
    description: string;
    acceptanceCriteria: string;
  };
}

export async function POST(req: Request) {
  // Check AI permission first
  const permissionError = checkAiPermission(APP_ID, '/api/apps/scrum-board/ai-generate');
  if (permissionError) return permissionError;

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

    // Check LLM configuration
    const configError = checkLLMConfig();
    if (configError) {
      return NextResponse.json(
        { ok: false, error: configError },
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
  } catch (e: unknown) {
    console.error('AI generate error:', e);
    const message = e instanceof Error ? e.message : String(e);
    const statusCode = e instanceof LLMError ? e.statusCode || 500 : 500;
    return NextResponse.json(
      { ok: false, error: message },
      { status: statusCode }
    );
  }
}
