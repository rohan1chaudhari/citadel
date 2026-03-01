'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatClientProps {
  initialMessages: Message[];
}

export function ChatClient({ initialMessages }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserId = Date.now();
    const userMessage: Message = {
      id: tempUserId,
      role: 'user',
      content: userContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch('/api/apps/{{app_id}}/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userContent }),
      });

      const data = await res.json();

      if (data.ok) {
        // Add assistant response
        const assistantMessage: Message = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.response,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Show error as assistant message
        const errorMessage: Message = {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Error: ${data.error || 'Failed to get response'}`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (err) {
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Error: Failed to connect to AI service',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  function clearChat() {
    if (confirm('Clear all chat history?')) {
      setMessages([]);
      // Optional: call API to clear DB history
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-400 py-12">
            <p className="text-lg mb-2">👋 Welcome to {{app_name}}!</p>
            <p className="text-sm">Send a message to start chatting with AI.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                <span className="text-xs opacity-50 mt-1 block">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </form>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-zinc-400">
            {messages.length} messages
          </span>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-zinc-400 hover:text-red-500"
            >
              Clear chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
