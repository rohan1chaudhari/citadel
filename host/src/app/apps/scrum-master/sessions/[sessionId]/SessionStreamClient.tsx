'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Shell } from '@/components/Shell';

interface SessionLog {
  id: number;
  chunk: string;
  created_at: string;
}

interface SessionInfo {
  id: string;
  task_id: number;
  status: string;
  started_at: string;
  ended_at: string | null;
}

interface TaskInfo {
  id: number;
  title: string;
  status: string;
  priority: string;
}

export default function SessionStreamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [task, setTask] = useState<TaskInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Unwrap params
  useEffect(() => {
    params.then(p => setSessionId(p.sessionId));
  }, [params]);

  // Fetch initial session data
  useEffect(() => {
    if (!sessionId) return;
    
    fetch(`/api/apps/scrum-board/sessions/${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setSession(data.session);
          setTask(data.session.task);
          // Check if session already ended
          if (data.session.ended_at || ['completed', 'failed', 'blocked', 'archived'].includes(data.session.status)) {
            setIsEnded(true);
          }
        }
      })
      .catch(err => setError(String(err)));
  }, [sessionId]);

  // Set up SSE connection
  useEffect(() => {
    if (!sessionId || isEnded) return;

    const es = new EventSource(`/api/apps/scrum-board/sessions/${encodeURIComponent(sessionId)}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('connected', (e) => {
      setIsConnected(true);
      setError(null);
      const data = JSON.parse((e as MessageEvent).data);
      console.log('SSE connected:', data);
    });

    es.addEventListener('log', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLogs(prev => [...prev, { id: data.id, chunk: data.chunk, created_at: data.created_at }]);
    });

    es.addEventListener('ended', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setIsEnded(true);
      setIsConnected(false);
      es.close();
      console.log('Session ended:', data);
    });

    es.addEventListener('error', (e) => {
      console.error('SSE error:', e);
      setError('Connection error');
      setIsConnected(false);
    });

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
    };
  }, [sessionId, isEnded]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && terminalRef.current && !isUserScrolling) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isUserScrolling]);

  const handleScroll = () => {
    if (!terminalRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // If user scrolls up, pause auto-scroll
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
      setIsUserScrolling(true);
    }
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Resume auto-scroll after 3 seconds of no scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      if (terminalRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        const isStillAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isStillAtBottom) {
          setAutoScroll(true);
        }
      }
    }, 3000);
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    setIsUserScrolling(false);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  // Combine all log chunks for display
  const terminalContent = logs.map(l => l.chunk).join('');

  return (
    <Shell
      title="Session Stream"
      subtitle={sessionId ? `Session: ${sessionId.slice(0, 32)}...` : 'Loading...'}
    >
      {/* Status bar */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-sm text-green-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            ) : isEnded ? (
              <span className="flex items-center gap-1.5 text-sm text-zinc-600">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Ended
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Connecting...
              </span>
            )}
            
            {session && (
              <span className="text-sm text-zinc-600">
                Status: <span className="font-medium">{session.status}</span>
              </span>
            )}
            
            {task && (
              <span className="text-sm text-zinc-600">
                Task: <span className="font-medium">#{task.id} {task.title}</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!autoScroll && (
              <button
                onClick={scrollToBottom}
                className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                Resume auto-scroll
              </button>
            )}
            <span className="text-xs text-zinc-500">
              {logs.length} chunks
            </span>
          </div>
        </div>
        
        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 rounded p-2">
            {error}
          </div>
        )}
      </Card>

      {/* Terminal */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-2 text-xs text-zinc-400 font-mono">terminal</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => {
                  setAutoScroll(e.target.checked);
                  if (e.target.checked) scrollToBottom();
                }}
                className="rounded border-zinc-600"
              />
              Auto-scroll
            </label>
          </div>
        </div>
        
        <div
          ref={terminalRef}
          onScroll={handleScroll}
          className="bg-zinc-950 p-4 font-mono text-sm text-zinc-300 h-[60vh] overflow-y-auto"
          style={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {terminalContent ? (
            terminalContent
          ) : (
            <span className="text-zinc-600">Waiting for output...</span>
          )}
          {isConnected && (
            <span className="inline-block w-2 h-4 bg-zinc-400 ml-0.5 animate-pulse" />
          )}
        </div>
      </Card>

      {/* Task info */}
      {task && (
        <Card className="mt-4">
          <div className="text-sm font-semibold mb-2">Task Details</div>
          <div className="grid gap-2 text-sm">
            <div className="flex gap-2">
              <span className="text-zinc-500 w-16">ID:</span>
              <span>#{task.id}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-16">Title:</span>
              <span>{task.title}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-16">Status:</span>
              <span className={`font-medium ${
                task.status === 'in_progress' ? 'text-amber-600' :
                task.status === 'done' ? 'text-green-600' :
                task.status === 'failed' ? 'text-red-600' :
                'text-zinc-600'
              }`}>
                {task.status}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-16">Priority:</span>
              <span className={`font-medium ${
                task.priority === 'high' ? 'text-red-600' :
                task.priority === 'medium' ? 'text-amber-600' :
                'text-zinc-600'
              }`}>
                {task.priority}
              </span>
            </div>
          </div>
          
          <div className="mt-4">
            <a
              href={`/apps/scrum-board?app=${encodeURIComponent(task.id.toString())}`}
              className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Board
            </a>
          </div>
        </Card>
      )}
    </Shell>
  );
}
