'use client';

import { useState } from 'react';
import { Button, Card, Input, Label } from '@/components/Shell';

interface SuggestedTask {
  title: string;
  description: string;
  acceptanceCriteria: string;
  selected?: boolean;
}

interface VisionSuggestion {
  vision: string;
  tasks: SuggestedTask[];
  stateContent?: string | null;
  hasState: boolean;
  isFresh?: boolean;
  stateCommit?: string | null;
  currentCommit?: string | null;
}

interface VisionSuggestPanelProps {
  appId: string;
  onTasksCreated?: () => void;
}

export function VisionSuggestPanel({ appId, onTasksCreated }: VisionSuggestPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<VisionSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [showState, setShowState] = useState(false);

  const generateVision = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setCreatedCount(0);

    try {
      const res = await fetch('/api/apps/scrum-board/vision-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, forceRefresh }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to generate vision');
      }

      // Mark all tasks as selected by default
      setSuggestion({
        ...data,
        tasks: data.tasks.map((t: SuggestedTask) => ({ ...t, selected: true })),
      });
    } catch (err: any) {
      setError(err?.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (index: number) => {
    if (!suggestion) return;
    const newTasks = [...suggestion.tasks];
    newTasks[index].selected = !newTasks[index].selected;
    setSuggestion({ ...suggestion, tasks: newTasks });
  };

  const createTasks = async () => {
    if (!suggestion) return;

    const selectedTasks = suggestion.tasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) {
      setError('Select at least one task');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      let created = 0;
      for (const task of selectedTasks) {
        const res = await fetch('/api/apps/scrum-board/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId,
            title: task.title,
            description: task.description,
            acceptanceCriteria: task.acceptanceCriteria,
            priority: 'medium',
            status: 'backlog',
          }),
        });

        if (res.ok) created++;
      }

      setCreatedCount(created);
      if (created > 0 && onTasksCreated) {
        onTasksCreated();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create tasks');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">AI Vision Suggestion</h3>
          <p className="text-sm text-zinc-500">
            Generate a vision and proposed tasks for {appId}
          </p>
        </div>
        <Button onClick={() => generateVision()} disabled={loading}>
          {loading ? 'Generating...' : '✨ Generate Vision'}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {createdCount > 0 && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm mb-4">
          ✓ Created {createdCount} task{createdCount !== 1 ? 's' : ''}!
        </div>
      )}

      {suggestion && (
        <div className="space-y-4">
          {/* Vision Statement */}
          <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
            <div className="text-xs font-medium text-indigo-700 uppercase mb-1">
              Proposed Vision
            </div>
            <p className="text-zinc-800">{suggestion.vision}</p>
            
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
                    title={`State: ${suggestion.stateCommit?.slice(0, 8)}... Current: ${suggestion.currentCommit?.slice(0, 8)}...`}
                  >
                    {suggestion.isFresh ? '📄 State up-to-date' : '⚠️ State outdated'}
                  </span>
                  <button
                    onClick={() => generateVision(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition"
                  >
                    🔄 Refresh
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-700">
                  ⚠️ No state file — analysis created
                </span>
              )}
            </div>
            
            {!suggestion.isFresh && (
              <div className="mt-2 text-xs text-amber-600">
                ⚠️ Code changed since last analysis. Suggestions may include already-built features.
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
                  <div className="mt-2 p-3 rounded bg-white border border-zinc-200 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {suggestion.stateContent}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Proposed Tasks</span>
              <span className="text-xs text-zinc-500">
                {suggestion.tasks.filter((t) => t.selected).length} of{' '}
                {suggestion.tasks.length} selected
              </span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {suggestion.tasks.map((task, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border transition cursor-pointer ${
                    task.selected
                      ? 'bg-white border-zinc-300'
                      : 'bg-zinc-50 border-zinc-200 opacity-60'
                  }`}
                  onClick={() => toggleTask(idx)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.selected}
                      onChange={() => toggleTask(idx)}
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{task.title}</div>
                      <div className="text-xs text-zinc-600 mt-1">
                        {task.description}
                      </div>
                      <div className="text-xs text-zinc-500 mt-2">
                        <span className="font-medium">Acceptance:</span>{' '}
                        {task.acceptanceCriteria.slice(0, 100)}
                        {task.acceptanceCriteria.length > 100 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={createTasks} disabled={creating}>
              {creating
                ? 'Creating...'
                : `Add ${suggestion.tasks.filter((t) => t.selected).length} Tasks to Board`}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSuggestion(null)}
              disabled={creating}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
