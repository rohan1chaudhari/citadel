import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runtime = 'nodejs';

// Get repo root (host/src/app/api/apps/install -> ../../../.. -> repo root)
const REPO_ROOT = path.resolve(__dirname, '../../../../../..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'citadel-app.mjs');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { appId } = body;

    if (!appId || typeof appId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'appId is required' },
        { status: 400 }
      );
    }

    // Validate app ID format
    const APP_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
    if (!APP_ID_RE.test(appId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid app ID format' },
        { status: 400 }
      );
    }

    // Run the CLI install command
    const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
      const proc = spawn('node', [CLI_PATH, 'install', appId], {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        resolve({ stdout, stderr, code: code ?? 1 });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    if (result.code !== 0) {
      // Extract error message from stderr/stdout
      const errorOutput = result.stderr || result.stdout;
      const errorMatch = errorOutput.match(/Error:\s*(.+)/i);
      const errorMessage = errorMatch ? errorMatch[1] : 'Installation failed';
      
      return NextResponse.json(
        { ok: false, error: errorMessage, details: errorOutput },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `App "${appId}" installed successfully`,
      appId,
      url: `/apps/${appId}`
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
