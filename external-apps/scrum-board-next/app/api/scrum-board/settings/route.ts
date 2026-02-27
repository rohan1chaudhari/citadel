import { NextResponse } from 'next/server';
import { getSetting, setSetting, ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

export async function GET() {
  ensureScrumBoardSchema();
  
  const autopilotEnabled = getSetting('autopilot_enabled') !== 'false';
  
  return NextResponse.json({
    ok: true,
    settings: {
      autopilot_enabled: autopilotEnabled,
    },
  });
}

export async function PATCH(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  
  if (body?.autopilot_enabled !== undefined) {
    const value = Boolean(body.autopilot_enabled) ? 'true' : 'false';
    setSetting('autopilot_enabled', value);
    audit(APP_ID, 'scrum.settings.update', { key: 'autopilot_enabled', value });
  }
  
  const autopilotEnabled = getSetting('autopilot_enabled') !== 'false';
  
  return NextResponse.json({
    ok: true,
    settings: {
      autopilot_enabled: autopilotEnabled,
    },
  });
}
