import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { exec, spawn } from 'child_process';
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

type AgentResult = {
  vision: string;
  tasks: SuggestedTask[];
  stateSummary: string;
  lastAnalyzedCommit: string;
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

async function runOpenClawAnalysisAgent(appId: string, currentCommit: string | null): Promise<AgentResult> {
  const statePath = getStatePath(appId);
  const commitToUse = currentCommit || 'initial';
  const sessionId = `vision-${appId}-${Date.now()}`;

  const prompt = `You are analyzing the Citadel app \"${appId}\".

Goal:
1) Read the app code SELECTIVELY (do not read every file end-to-end).
2) Build a high-confidence state summary.
3) Write/update: ${statePath}
4) Return JSON with vision+tasks.

Rules for selective reading:
- First map files under:
  - /home/rohanchaudhari/personal/citadel/host/src/app/apps/${appId}
  - /home/rohanchaudhari/personal/citadel/host/src/app/api/apps/${appId}
- Prioritize high-signal files: page.tsx, top-level components, route.ts, schema/db/util files.
- Read partial snippets where possible.
- Follow imports only when needed to resolve uncertainty.
- Stop when confidence is sufficient.

State file format (must write exactly this frontmatter keys):
---
lastAnalyzedCommit: ${commitToUse}
lastAnalyzedAt: <ISO datetime>
---

Then markdown sections exactly:
## Summary
## Features (IMPLEMENTED)
## Data Model
## UI Components
## API Routes
## Technical Notes
## Enhancement Opportunities
## New Feature Opportunities

Final output must be STRICT JSON only (no prose):
{
  "vision": "1-2 sentence vision",
  "tasks": [
    {"title":"...","description":"...","acceptanceCriteria":"..."}
  ],
  "stateSummary": "the markdown written to state file",
  "lastAnalyzedCommit": "${commitToUse}"
}

Constraints:
- tasks length: 3-7
- no markdown fences in JSON
- keep tasks concrete and buildable`;

  const args = [
    'agent',
    '--local',
    '--json',
    '--session-id',
    sessionId,
    '--timeout',
    '240',
    '--message',
    prompt,
  ];

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn('openclaw', args, {
      cwd: REPO_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => (out += String(d)));
    child.stderr?.on('data', (d) => (err += String(d)));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(err || out || `openclaw agent exited ${code}`));
      } else {
        resolve(out);
      }
    });
  });

  // Try direct parse first
  let envelope: any;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    const match = stdout.match(/\{[\s\S]*\}$/);
    if (!match) throw new Error(`Unable to parse openclaw output: ${stdout.slice(0, 800)}`);
    envelope = JSON.parse(match[0]);
  }

  const text = envelope?.result?.outputText ?? envelope?.outputText ?? envelope?.text ?? '';
  if (!text) {
    throw new Error('OpenClaw agent returned empty outputText');
  }

  let parsed: AgentResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = String(text).match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!m) throw new Error('Failed to parse agent JSON payload');
    parsed = JSON.parse(m[1].trim());
  }

  if (!parsed?.vision || !Array.isArray(parsed?.tasks) || !parsed?.stateSummary) {
    throw new Error('Agent payload missing required fields');
  }

  return parsed;
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
    let visionResult: { vision: string; tasks: SuggestedTask[] };
    const shouldRefresh = !existingState || forceRefresh || !isFresh;

    if (shouldRefresh) {
      // Stale/missing state: use OpenClaw agent for selective code reading + state write + vision/task generation
      const agent = await runOpenClawAnalysisAgent(appId, currentCommit);
      stateSummary = agent.stateSummary;
      // Ensure state file exists even if agent skipped write due tool/runtime issue
      await writeStateFile(appId, agent.lastAnalyzedCommit || currentCommit, stateSummary);
      visionResult = { vision: agent.vision, tasks: agent.tasks };
    } else {
      // Fresh state: no heavy analysis, only derive a new vision/tasks set from saved state
      visionResult = await generateVisionAndTasks(appId, stateSummary);
    }

    return NextResponse.json({
      ok: true,
      vision: visionResult.vision,
      tasks: visionResult.tasks,
      stateContent: stateSummary,
      hasState: true,
      isFresh: shouldRefresh ? true : isFresh,
      stateCommit: currentCommit,
      currentCommit,
      refreshed: shouldRefresh,
      source: shouldRefresh ? 'openclaw-agent' : 'cached-state',
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
