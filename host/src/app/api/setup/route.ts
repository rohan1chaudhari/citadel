import { NextRequest, NextResponse } from 'next/server';
import { isSetupComplete, saveApiKeys, completeSetup } from '@citadel/core';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const setupComplete = isSetupComplete();
    return NextResponse.json({ ok: true, setupComplete });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Don't allow completing setup if already done
    if (isSetupComplete()) {
      return NextResponse.json(
        { ok: false, error: 'Setup already completed' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { openaiApiKey, anthropicApiKey } = body;

    // Save API keys if provided
    if (openaiApiKey || anthropicApiKey) {
      saveApiKeys(openaiApiKey, anthropicApiKey);
    }

    // Mark setup as complete
    completeSetup();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
