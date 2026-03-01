import { Shell } from '@/components/Shell';
import { dbQuery } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';
import { ChatClient } from './ChatClient';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export default async function {{AppName}}Page() {
  await requirePermissionConsent(APP_ID);

  // Load chat history
  const messages = dbQuery<Message>(
    APP_ID,
    `SELECT id, role, content, created_at 
     FROM messages 
     ORDER BY created_at ASC 
     LIMIT 100`
  );

  const serializedMessages = JSON.parse(
    JSON.stringify(messages, (k, v) => (typeof v === 'bigint' ? Number(v) : v))
  );

  return (
    <Shell title="{{app_name}}" subtitle="Chat with AI">
      <ChatClient initialMessages={serializedMessages} />
    </Shell>
  );
}
