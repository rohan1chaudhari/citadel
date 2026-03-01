import { NextResponse } from 'next/server';
import { getSetting, setSetting, ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
import { audit } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

export async function GET() {
  ensureScrumBoardSchema();
  
  const autopilotEnabled = getSetting('autopilot_enabled') !== 'false';
  const agentRunner = getSetting('agent_runner') || 'openclaw';
  const llmProvider = getSetting('llm_provider') || 'openai';
  const llmModel = getSetting('llm_model') || '';
  
  return NextResponse.json({
    ok: true,
    settings: {
      autopilot_enabled: autopilotEnabled,
      agent_runner: agentRunner,
      llm_provider: llmProvider,
      llm_model: llmModel,
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
  
  if (body?.agent_runner !== undefined) {
    const value = String(body.agent_runner).trim();
    setSetting('agent_runner', value);
    audit(APP_ID, 'scrum.settings.update', { key: 'agent_runner', value });
  }
  
  if (body?.llm_provider !== undefined) {
    const value = String(body.llm_provider).trim().toLowerCase();
    if (value === 'openai' || value === 'anthropic') {
      setSetting('llm_provider', value);
      audit(APP_ID, 'scrum.settings.update', { key: 'llm_provider', value });
    }
  }
  
  if (body?.llm_model !== undefined) {
    const value = String(body.llm_model).trim();
    setSetting('llm_model', value);
    audit(APP_ID, 'scrum.settings.update', { key: 'llm_model', value });
  }
  
  const autopilotEnabled = getSetting('autopilot_enabled') !== 'false';
  const agentRunner = getSetting('agent_runner') || 'openclaw';
  const llmProvider = getSetting('llm_provider') || 'openai';
  const llmModel = getSetting('llm_model') || '';
  
  return NextResponse.json({
    ok: true,
    settings: {
      autopilot_enabled: autopilotEnabled,
      agent_runner: agentRunner,
      llm_provider: llmProvider,
      llm_model: llmModel,
    },
  });
}
