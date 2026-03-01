// LLM Provider Abstraction Layer
// Supports: OpenAI, Anthropic (MVP)
// Configuration via settings: llm_provider, llm_model

import { getSetting } from './scrumBoardSchema';

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMMessage {
  role: 'system' | 'user';
  content: string;
}

export interface LLMJSONSchema {
  type: 'object';
  additionalProperties?: boolean;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface LLMOptions {
  model: string;
  temperature: number;
  messages: LLMMessage[];
  jsonSchema?: {
    name: string;
    schema: LLMJSONSchema;
  };
}

export interface LLMResponse {
  text: string;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public provider: LLMProvider,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

function getEnvKey(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    default:
      throw new LLMError(`Unknown provider: ${provider}`, provider);
  }
}

function getApiUrl(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/responses';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    default:
      throw new LLMError(`Unknown provider: ${provider}`, provider);
  }
}

function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4.1-mini';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    default:
      throw new LLMError(`Unknown provider: ${provider}`, provider);
  }
}

/**
 * Get the configured LLM provider from settings.
 * Falls back to 'openai' if not set.
 */
export function getConfiguredProvider(): LLMProvider {
  const provider = getSetting('llm_provider');
  if (provider === 'anthropic') return 'anthropic';
  return 'openai'; // default
}

/**
 * Get the configured LLM model from settings.
 * Falls back to provider default if not set.
 */
export function getConfiguredModel(provider?: LLMProvider): string {
  const p = provider || getConfiguredProvider();
  const model = getSetting('llm_model');
  return model || getDefaultModel(p);
}

/**
 * Check if the LLM is properly configured.
 * Returns an error message if not configured, null if ready.
 */
export function checkLLMConfig(): string | null {
  const provider = getConfiguredProvider();
  const keyName = getEnvKey(provider);
  const key = process.env[keyName];
  
  if (!key) {
    return `${provider} API key not configured. Set ${keyName} environment variable.`;
  }
  
  return null;
}

/**
 * Build OpenAI request body
 */
function buildOpenAIRequest(options: LLMOptions): unknown {
  const body: Record<string, unknown> = {
    model: options.model,
    temperature: options.temperature,
    input: options.messages.map(m => ({ role: m.role, content: m.content })),
  };

  if (options.jsonSchema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: options.jsonSchema.name,
        strict: true,
        schema: options.jsonSchema.schema,
      },
    };
  }

  return body;
}

/**
 * Build Anthropic request body
 */
function buildAnthropicRequest(options: LLMOptions): unknown {
  const systemMsg = options.messages.find(m => m.role === 'system')?.content;
  const userMsgs = options.messages.filter(m => m.role === 'user');

  const body: Record<string, unknown> = {
    model: options.model,
    temperature: options.temperature,
    max_tokens: 4096,
    messages: userMsgs.map(m => ({ role: 'user', content: m.content })),
  };

  if (systemMsg) {
    body.system = systemMsg;
  }

  if (options.jsonSchema) {
    // Anthropic uses tool_use for structured output
    body.tools = [
      {
        name: options.jsonSchema.name,
        description: `Structured output matching ${options.jsonSchema.name} schema`,
        input_schema: options.jsonSchema.schema,
      },
    ];
    body.tool_choice = { type: 'tool', name: options.jsonSchema.name };
  }

  return body;
}

/**
 * Parse OpenAI response
 */
function parseOpenAIResponse(data: unknown): LLMResponse {
  const d = data as Record<string, unknown>;
  const text =
    (d.output as Array<{ content?: Array<{ text?: string }> }>)?.[0]?.content?.[0]?.text ??
    (d as { output_text?: string }).output_text ??
    '';

  if (!text) {
    throw new Error('Empty response from OpenAI');
  }

  return { text };
}

/**
 * Parse Anthropic response
 */
function parseAnthropicResponse(data: unknown): LLMResponse {
  const d = data as {
    content?: Array<{ type: string; text?: string; input?: unknown }>;
  };
  
  // Check for tool_use response (structured JSON)
  const toolContent = d.content?.find(c => c.type === 'tool_use');
  if (toolContent?.input) {
    return { text: JSON.stringify(toolContent.input) };
  }

  // Check for text response
  const textContent = d.content?.find(c => c.type === 'text');
  if (textContent?.text) {
    return { text: textContent.text };
  }

  throw new Error('Empty response from Anthropic');
}

/**
 * Send a request to the configured LLM provider.
 * Automatically uses settings for provider/model selection.
 */
export async function llmRequest(options: Omit<LLMOptions, 'model'> & { model?: string }): Promise<LLMResponse> {
  const provider = getConfiguredProvider();
  const model = options.model || getConfiguredModel(provider);
  const keyName = getEnvKey(provider);
  const key = process.env[keyName];

  if (!key) {
    throw new LLMError(
      `${provider} API key not configured. Set ${keyName} environment variable.`,
      provider,
      500
    );
  }

  const url = getApiUrl(provider);
  const body = provider === 'openai' 
    ? buildOpenAIRequest({ ...options, model })
    : buildAnthropicRequest({ ...options, model });

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${key}`,
  };

  // Anthropic requires specific header
  if (provider === 'anthropic') {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    delete headers.authorization;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = (data as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
    throw new LLMError(`LLM request failed (${res.status}): ${errorMsg}`, provider, res.status);
  }

  return provider === 'openai'
    ? parseOpenAIResponse(data)
    : parseAnthropicResponse(data);
}

/**
 * Parse JSON from LLM response, handling various formats
 */
export function parseLLMJSON(text: string): unknown {
  // Try direct parse first
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
