import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';

const execAsync = promisify(exec);
const KB_DIR = '/home/rohanchaudhari/personal/citadel/kb';
const REPO_DIR = '/home/rohanchaudhari/personal/citadel';
const HOST_DIR = '/home/rohanchaudhari/personal/citadel/host';

type AppState = {
  lastAnalyzedCommit: string;
  lastAnalyzedAt: string;
  summary: string;
};

type SuggestedTask = {
  title: string;
  description: string;
  acceptanceCriteria: string;
};

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getStatePath(appId: string): string {
  return join(KB_DIR, `${appId}-state.md`);
}

async function getCurrentCommit(appId: string): Promise<string | null> {
  try {
    const frontendDir = `host/src/app/apps/${appId}`;
    const backendDir = `host/src/app/api/apps/${appId}`;

    const frontendExists = existsSync(join(REPO_DIR, frontendDir));
    const backendExists = existsSync(join(REPO_DIR, backendDir));

    if (!frontendExists && !backendExists) {
      return null;
    }

    const paths = [
      frontendExists ? frontendDir : null,
      backendExists ? backendDir : null,
    ].filter(Boolean) as string[];

    const { stdout } = await execAsync(
      `git log -1 --format="%H" -- ${paths.join(' ')}`,
      { cwd: REPO_DIR }
    );

    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function parseStateFile(appId: string): Promise<AppState | null> {
  const statePath = getStatePath(appId);
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = await readFile(statePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = frontmatterMatch[1];
    const lastAnalyzedCommit = frontmatter.match(/lastAnalyzedCommit:\s*(.+)/)?.[1]?.trim();
    const lastAnalyzedAt = frontmatter.match(/lastAnalyzedAt:\s*(.+)/)?.[1]?.trim();

    if (!lastAnalyzedCommit || !lastAnalyzedAt) return null;

    const summary = content.slice(frontmatterMatch[0].length).trim();
    return { lastAnalyzedCommit, lastAnalyzedAt, summary };
  } catch {
    return null;
  }
}

async function gatherCodeContext(appId: string): Promise<string> {
  const frontendPath = join(REPO_DIR, `host/src/app/apps/${appId}`);
  const backendPath = join(REPO_DIR, `host/src/app/api/apps/${appId}`);

  const snippets: string[] = [];

  async function maybeRead(path: string, label: string, max = 5000) {
    if (!existsSync(path)) return;
    try {
      const content = await readFile(path, 'utf-8');
      snippets.push(`\n## ${label}\n\n${content.slice(0, max)}`);
    } catch {
      // ignore unreadable files
    }
  }

  try {
    const { stdout } = await execAsync(`find ${frontendPath} -maxdepth 2 -type f | sort`, { cwd: REPO_DIR });
    snippets.push(`\n## Frontend Files\n${stdout.slice(0, 4000)}`);
  } catch {
    // ignore
  }

  try {
    const { stdout } = await execAsync(`find ${backendPath} -maxdepth 3 -type f | sort`, { cwd: REPO_DIR });
    snippets.push(`\n## Backend Files\n${stdout.slice(0, 4000)}`);
  } catch {
    // ignore
  }

  await maybeRead(join(frontendPath, 'page.tsx'), 'Frontend page.tsx');

  try {
    const { stdout } = await execAsync(`find ${frontendPath} -maxdepth 1 -name '*.tsx' -type f | sort | head -n 6`, { cwd: REPO_DIR });
    const files = stdout.trim().split('\n').filter(Boolean);
    for (const fp of files) {
      if (fp.endsWith('/page.tsx')) continue;
      await maybeRead(fp, `Frontend component: ${fp.replace(REPO_DIR + '/', '')}`, 3000);
    }
  } catch {
    // ignore
  }

  try {
    const { stdout } = await execAsync(`find ${backendPath} -name 'route.ts' -type f | sort | head -n 10`, { cwd: REPO_DIR });
    const files = stdout.trim().split('\n').filter(Boolean);
    for (const fp of files) {
      await maybeRead(fp, `Backend route: ${fp.replace(REPO_DIR + '/', '')}`, 3000);
    }
  } catch {
    // ignore
  }

  try {
    const { stdout } = await execAsync(
      `git log --oneline -n 10 -- host/src/app/apps/${appId} host/src/app/api/apps/${appId}`,
      { cwd: REPO_DIR }
    );
    snippets.push(`\n## Recent Commits\n${stdout}`);
  } catch {
    // ignore
  }

  return snippets.join('\n').slice(0, 40000);
}

async function generateStateSummary(appId: string, codeContext: string): Promise<string> {
  const key = requireEnv('OPENAI_API_KEY');

  const systemPrompt = `You are a product+engineering analyst. Create a concise but concrete app state summary in markdown. Focus on what exists in code.`;
  const userPrompt = `Analyze app: ${appId}\n\nCode context:\n${codeContext}\n\nReturn markdown with these sections exactly:\n## Summary\n## Features (IMPLEMENTED)\n## Data Model\n## UI Components\n## API Routes\n## Technical Notes\n## Enhancement Opportunities\n## New Feature Opportunities`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`State generation failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const text = data?.output?.[0]?.content?.[0]?.text ?? data?.output_text ?? '';
  if (!text) throw new Error('Empty state summary from LLM');
  return String(text).trim();
}

async function generateVisionAndTasks(appId: string, stateSummary: string): Promise<{ vision: string; tasks: SuggestedTask[] }> {
  const key = requireEnv('OPENAI_API_KEY');

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
          name: 'vision_tasks',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              vision: { type: 'string' },
              tasks: {
                type: 'array',
                minItems: 3,
                maxItems: 7,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    acceptanceCriteria: { type: 'string' },
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
        {
          role: 'system',
          content:
            'You are a product strategist. Propose one inspiring but practical vision and 3-7 actionable tasks based only on current app state.',
        },
        {
          role: 'user',
          content: `App: ${appId}\n\nState summary:\n${stateSummary}`,
        },
      ],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Vision generation failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const text = data?.output?.[0]?.content?.[0]?.text ?? data?.output_text ?? '';
  if (!text) throw new Error('Empty vision response from LLM');

  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    throw new Error('Failed to parse vision response as JSON');
  }
}

async function writeStateFile(appId: string, commit: string | null, summary: string) {
  const statePath = getStatePath(appId);
  const content = `---\nlastAnalyzedCommit: ${commit || 'initial'}\nlastAnalyzedAt: ${new Date().toISOString()}\n---\n\n${summary}\n`;
  await writeFile(statePath, content, 'utf-8');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const appId = String(body?.appId ?? '').trim();
    const forceRefresh = Boolean(body?.forceRefresh);

    if (!appId) {
      return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const currentCommit = await getCurrentCommit(appId);
    const existingState = await parseStateFile(appId);
    const isFresh = existingState?.lastAnalyzedCommit === currentCommit;

    let stateSummary = existingState?.summary || '';

    if (!existingState || forceRefresh || !isFresh) {
      const codeContext = await gatherCodeContext(appId);
      stateSummary = await generateStateSummary(appId, codeContext);
      await writeStateFile(appId, currentCommit, stateSummary);
    }

    const visionResult = await generateVisionAndTasks(appId, stateSummary);

    return NextResponse.json({
      ok: true,
      vision: visionResult.vision,
      tasks: visionResult.tasks,
      stateContent: stateSummary,
      hasState: true,
      isFresh: existingState ? isFresh : true,
      stateCommit: currentCommit,
      currentCommit,
      refreshed: !existingState || forceRefresh || !isFresh,
    });
  } catch (e: any) {
    console.error('Vision suggest error:', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId')?.trim();

    if (!appId) {
      return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
    }

    const state = await parseStateFile(appId);
    const currentCommit = await getCurrentCommit(appId);

    return NextResponse.json({
      ok: true,
      stateContent: state?.summary || null,
      hasState: state !== null,
      isFresh: state?.lastAnalyzedCommit === currentCommit,
      stateCommit: state?.lastAnalyzedCommit || null,
      currentCommit,
    });
  } catch (e: any) {
    console.error('Vision suggest GET error:', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
