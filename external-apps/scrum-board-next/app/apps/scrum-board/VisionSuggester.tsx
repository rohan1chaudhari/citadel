'use client';

import { useState } from 'react';
import { Button, Card, Textarea } from '@/components/Shell';

interface ProposedTask {
  title: string;
  description: string;
  acceptanceCriteria: string;
  status: 'pending' | 'approved' | 'rejected' | 'adding' | 'added' | 'error';
  taskId?: number;
  error?: string;
}

interface VisionSuggestion {
  vision: string;
  tasks: ProposedTask[];
  stateContent?: string | null;
  hasState?: boolean;
  isFresh?: boolean;
  stateCommit?: string | null;
  currentCommit?: string | null;
}

interface VisionSuggesterProps {
  appId: string;
  onTasksAdded?: () => void;
}

export default function VisionSuggester({ appId, onTasksAdded }: VisionSuggesterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<VisionSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showState, setShowState] = useState(false);

  async function generateVision(forceRefresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('api/scrum-board/vision-suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appId, forceRefresh }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to generate vision');
        return;
      }
      setSuggestion({
        vision: data.vision,
        tasks: data.tasks.map((t: ProposedTask) => ({ ...t, status: 'pending' as const })),
        stateContent: data.stateContent,
        hasState: data.hasState,
        isFresh: data.isFresh,
        stateCommit: data.stateCommit,
        currentCommit: data.currentCommit,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to generate vision');
    } finally {
      setLoading(false);
    }
  }

  async function approveTask(index: number) {
    if (!suggestion) return;
    
    const task = suggestion.tasks[index];
    const updatedTasks = [...suggestion.tasks];
    updatedTasks[index] = { ...task, status: 'adding' };
    setSuggestion({ ...suggestion, tasks: updatedTasks });

    try {
      const res = await fetch('api/scrum-board/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appId,
          title: task.title,
          description: task.description,
          acceptance_criteria: task.acceptanceCriteria,
          priority: 'medium',
          status: 'backlog',
        }),
      });
      const data = await res.json();
      
      if (!res.ok || !data?.ok) {
        updatedTasks[index] = { ...task, status: 'error', error: data?.error || 'Failed to add task' };
      } else {
        updatedTasks[index] = { ...task, status: 'added', taskId: data.task?.id };
      }
    } catch (e: any) {
      updatedTasks[index] = { ...task, status: 'error', error: e?.message || 'Failed to add task' };
    }
    
    setSuggestion({ ...suggestion, tasks: updatedTasks });
    
    // Notify parent that tasks were added
    if (onTasksAdded) {
      onTasksAdded();
    }
  }

  function rejectTask(index: number) {
    if (!suggestion) return;
    const updatedTasks = [...suggestion.tasks];
    updatedTasks[index] = { ...updatedTasks[index], status: 'rejected' };
    setSuggestion({ ...suggestion, tasks: updatedTasks });
  }

  function resetTask(index: number) {
    if (!suggestion) return;
    const updatedTasks = [...suggestion.tasks];
    updatedTasks[index] = { ...updatedTasks[index], status: 'pending', error: undefined };
    setSuggestion({ ...suggestion, tasks: updatedTasks });
  }

  const approvedCount = suggestion?.tasks.filter(t => t.status === 'added').length || 0;
  const rejectedCount = suggestion?.tasks.filter(t => t.status === 'rejected').length || 0;
  const totalCount = suggestion?.tasks.length || 0;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
        title="Get AI vision suggestion for this app"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-xs font-medium">Vision</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6" onClick={() => setIsOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="text-lg font-semibold">Vision Suggester</h3>
              </div>
              <button 
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 active:bg-zinc-100" 
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>

            {!suggestion && !loading && !error && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-zinc-900 mb-2">Generate Vision for {appId}</h4>
                <p className="text-sm text-zinc-600 mb-6 max-w-md mx-auto">
                  AI will analyze the app and suggest a compelling vision statement along with concrete tasks to achieve it.
                </p>
                <Button onClick={() => generateVision()} disabled={loading}>
                  Generate Vision & Tasks
                </Button>
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <div className="inline-flex items-center gap-3">
                  <svg className="w-6 h-6 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-zinc-600">Generating vision and tasks...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Error</span>
                </div>
                {error}
                <div className="mt-3">
                  <Button variant="secondary" onClick={() => { setError(null); generateVision(); }}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {suggestion && (
              <div className="space-y-6">
                {/* Vision Statement */}
                <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-sm font-medium text-indigo-900">Vision</span>
                  </div>
                  <p className="text-zinc-800 leading-relaxed">{suggestion.vision}</p>
                  
                  {/* Context sources */}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {suggestion.hasState ? (
                      <>
                        <span 
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                            suggestion.isFresh 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}
                          title={`State commit: ${suggestion.stateCommit?.slice(0, 8)}... Current: ${suggestion.currentCommit?.slice(0, 8)}...`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {suggestion.isFresh ? 'State up-to-date' : 'State outdated'}
                        </span>
                        <button
                          onClick={() => {
                            setSuggestion(null);
                            generateVision(true); // force refresh
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        No state file — analysis created
                      </span>
                    )}
                  </div>
                  
                  {!suggestion.isFresh && (
                    <div className="mt-2 text-xs text-amber-600">
                      ⚠️ Code has changed since last analysis. Suggestions may include features you've already built.
                    </div>
                  )}
                  
                  {/* State Content Toggle */}
                  {suggestion.stateContent && (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowState(!showState)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <svg 
                          className={`w-3 h-3 transition-transform ${showState ? 'rotate-90' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {showState ? 'Hide analyzed state' : 'Show analyzed state'}
                      </button>
                      
                      {showState && (
                        <div className="mt-2 p-3 rounded bg-zinc-50 border border-zinc-200 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {suggestion.stateContent}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-zinc-600">{approvedCount} approved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                    <span className="text-zinc-600">{rejectedCount} rejected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="text-zinc-600">{totalCount - approvedCount - rejectedCount} pending</span>
                  </div>
                </div>

                {/* Proposed Tasks */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-900">Proposed Tasks</h4>
                  {suggestion.tasks.map((task, index) => (
                    <div
                      key={index}
                      className={`rounded-lg border p-4 transition ${
                        task.status === 'added'
                          ? 'border-green-200 bg-green-50/30'
                          : task.status === 'rejected'
                          ? 'border-zinc-200 bg-zinc-50/50 opacity-60'
                          : task.status === 'error'
                          ? 'border-red-200 bg-red-50/30'
                          : 'border-zinc-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-zinc-900">{task.title}</h5>
                            {task.status === 'added' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Added #{task.taskId}
                              </span>
                            )}
                            {task.status === 'rejected' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600">
                                Rejected
                              </span>
                            )}
                            {task.status === 'adding' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Adding...
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-600 mb-2">{task.description}</p>
                          <div className="text-xs text-zinc-500 bg-zinc-50 rounded p-2">
                            <span className="font-medium">Acceptance Criteria:</span>
                            <div className="whitespace-pre-wrap mt-1">{task.acceptanceCriteria}</div>
                          </div>
                          {task.error && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                              Error: {task.error}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {task.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveTask(index)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approve & Add
                            </button>
                            <button
                              onClick={() => rejectTask(index)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-200 text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                          </>
                        )}
                        {task.status === 'rejected' && (
                          <button
                            onClick={() => resetTask(index)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-200 text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Undo
                          </button>
                        )}
                        {task.status === 'error' && (
                          <button
                            onClick={() => resetTask(index)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-200 text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Regenerate button */}
                <div className="pt-4 border-t border-zinc-200">
                  <button
                    onClick={() => {
                      setSuggestion(null);
                      generateVision();
                    }}
                    disabled={loading}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Generate new vision →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
