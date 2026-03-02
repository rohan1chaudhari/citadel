'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Edit, 
  ChevronDown, 
  ChevronUp,
  Zap,
  Clock,
  Activity,
  CheckCircle,
  XCircle
} from 'lucide-react';

type WorkflowTrigger = {
  event: string;
  appId?: string;
};

type WorkflowCondition = {
  path: string;
  operator: 'eq' | 'ne' | 'contains' | 'gt' | 'lt';
  value: unknown;
};

type WorkflowAction = {
  action: string;
  payload?: Record<string, unknown>;
};

type Workflow = {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
  runCount: number;
  lastRunAt?: string;
};

type WorkflowExecution = {
  id: number;
  workflowId: number;
  triggeredBy: string;
  triggerEvent: string;
  actionsExecuted: number;
  success: boolean;
  startedAt: string;
  error?: string;
};

type WorkflowStats = {
  total: number;
  enabled: number;
  disabled: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [expandedWorkflow, setExpandedWorkflow] = useState<number | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTriggerEvent, setFormTriggerEvent] = useState('');
  const [formTriggerAppId, setFormTriggerAppId] = useState('');
  const [formActions, setFormActions] = useState<WorkflowAction[]>([{ action: '', payload: {} }]);
  
  const fetchWorkflows = useCallback(async () => {
    try {
      const response = await fetch('/api/citadel/workflows?stats=true&executions=true');
      const data = await response.json();
      if (data.ok) {
        setWorkflows(data.workflows);
        setStats(data.stats);
        setRecentExecutions(data.recentExecutions || []);
      }
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);
  
  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormTriggerEvent('');
    setFormTriggerAppId('');
    setFormActions([{ action: '', payload: {} }]);
    setEditingWorkflow(null);
  };
  
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formName,
      description: formDescription || undefined,
      trigger: {
        event: formTriggerEvent,
        appId: formTriggerAppId || undefined,
      },
      actions: formActions.filter(a => a.action.trim() !== ''),
    };
    
    try {
      const response = await fetch('/api/citadel/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      if (data.ok) {
        resetForm();
        setShowCreateForm(false);
        fetchWorkflows();
      } else {
        alert(data.error || 'Failed to create workflow');
      }
    } catch (err) {
      console.error('Failed to create workflow:', err);
      alert('Failed to create workflow');
    }
  };
  
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkflow) return;
    
    const payload = {
      id: editingWorkflow.id,
      name: formName,
      description: formDescription || undefined,
      trigger: {
        event: formTriggerEvent,
        appId: formTriggerAppId || undefined,
      },
      actions: formActions.filter(a => a.action.trim() !== ''),
    };
    
    try {
      const response = await fetch('/api/citadel/workflows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      if (data.ok) {
        resetForm();
        setEditingWorkflow(null);
        fetchWorkflows();
      } else {
        alert(data.error || 'Failed to update workflow');
      }
    } catch (err) {
      console.error('Failed to update workflow:', err);
      alert('Failed to update workflow');
    }
  };
  
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      const response = await fetch(`/api/citadel/workflows?id=${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      if (data.ok) {
        fetchWorkflows();
      } else {
        alert(data.error || 'Failed to delete workflow');
      }
    } catch (err) {
      console.error('Failed to delete workflow:', err);
      alert('Failed to delete workflow');
    }
  };
  
  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      const response = await fetch('/api/citadel/workflows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      
      const data = await response.json();
      if (data.ok) {
        fetchWorkflows();
      }
    } catch (err) {
      console.error('Failed to toggle workflow:', err);
    }
  };
  
  const startEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setFormName(workflow.name);
    setFormDescription(workflow.description || '');
    setFormTriggerEvent(workflow.trigger.event);
    setFormTriggerAppId(workflow.trigger.appId || '');
    setFormActions(workflow.actions.length > 0 ? workflow.actions : [{ action: '', payload: {} }]);
    setShowCreateForm(true);
  };
  
  const addAction = () => {
    if (formActions.length < 3) {
      setFormActions([...formActions, { action: '', payload: {} }]);
    }
  };
  
  const removeAction = (index: number) => {
    setFormActions(formActions.filter((_, i) => i !== index));
  };
  
  const updateAction = (index: number, field: keyof WorkflowAction, value: string) => {
    const newActions = [...formActions];
    if (field === 'action') {
      newActions[index].action = value;
    } else if (field === 'payload') {
      try {
        newActions[index].payload = JSON.parse(value);
      } catch {
        // Invalid JSON, ignore
      }
    }
    setFormActions(newActions);
  };
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-12">Loading workflows...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Workflow Automation
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If-this-then-that automation across your apps
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowCreateForm(!showCreateForm);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Workflows</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
              <div className="text-2xl font-semibold text-green-600">{stats.enabled}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Executions</div>
              <div className="text-2xl font-semibold">{stats.totalExecutions}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
              <div className="text-2xl font-semibold">
                {stats.totalExecutions > 0
                  ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                  : 0}%
              </div>
            </div>
          </div>
        )}
        
        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
            </h2>
            <form onSubmit={editingWorkflow ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="e.g., Log workouts to notes"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="What does this workflow do?"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Trigger Event</label>
                  <input
                    type="text"
                    value={formTriggerEvent}
                    onChange={(e) => setFormTriggerEvent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    placeholder="e.g., gym-tracker.workout.completed"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Use * for wildcards (e.g., *.created)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Source App (optional)</label>
                  <input
                    type="text"
                    value={formTriggerAppId}
                    onChange={(e) => setFormTriggerAppId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    placeholder="e.g., gym-tracker"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Actions (max 3)</label>
                  {formActions.length < 3 && (
                    <button
                      type="button"
                      onClick={addAction}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add Action
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {formActions.map((action, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={action.action}
                          onChange={(e) => updateAction(index, 'action', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                          placeholder="e.g., citadel.create-note"
                          required
                        />
                      </div>
                      {formActions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingWorkflow ? 'Update Workflow' : 'Create Workflow'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowCreateForm(false);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* Workflows List */}
        <div className="space-y-4">
          {workflows.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Zap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Create your first automation to connect your apps
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Create Workflow
              </button>
            </div>
          ) : (
            workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(workflow.id, workflow.enabled)}
                      className={`p-2 rounded-lg transition-colors ${
                        workflow.enabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                      title={workflow.enabled ? 'Disable' : 'Enable'}
                    >
                      {workflow.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <div>
                      <h3 className="font-medium">{workflow.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {workflow.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      workflow.enabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700'
                    }`}>
                      {workflow.enabled ? 'Active' : 'Paused'}
                    </span>
                    <button
                      onClick={() => startEdit(workflow)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(workflow.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedWorkflow(expandedWorkflow === workflow.id ? null : workflow.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      {expandedWorkflow === workflow.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                
                {expandedWorkflow === workflow.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Trigger</div>
                        <div className="font-medium">{workflow.trigger.event}</div>
                      </div>
                      {workflow.trigger.appId && (
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Source App</div>
                          <div className="font-medium">{workflow.trigger.appId}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Run Count</div>
                        <div className="font-medium">{workflow.runCount}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Last Run</div>
                        <div className="font-medium">{formatDate(workflow.lastRunAt)}</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Actions</div>
                      <div className="space-y-2">
                        {workflow.actions.map((action, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded"
                          >
                            <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </span>
                            <code className="font-mono">{action.action}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {/* Recent Executions */}
        {recentExecutions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Executions
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left px-4 py-2">Workflow</th>
                    <th className="text-left px-4 py-2">Event</th>
                    <th className="text-left px-4 py-2">Actions</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentExecutions.map((exec) => (
                    <tr key={exec.id}>
                      <td className="px-4 py-3">
                        {workflows.find(w => w.id === exec.workflowId)?.name || `Workflow ${exec.workflowId}`}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {exec.triggerEvent}
                        </code>
                      </td>
                      <td className="px-4 py-3">{exec.actionsExecuted}</td>
                      <td className="px-4 py-3">
                        {exec.success ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600" title={exec.error}>
                            <XCircle className="w-4 h-4" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(exec.startedAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
