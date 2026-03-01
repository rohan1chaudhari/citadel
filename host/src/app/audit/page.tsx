'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shell, Card, Button } from '@/components/Shell';

interface AuditEntry {
  id: number;
  ts: string;
  app_id: string;
  event: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const APPS = [
  { id: 'all', name: 'All Apps' },
  { id: 'citadel', name: 'Citadel' },
  { id: 'smart-notes', name: 'Smart Notes' },
  { id: 'gym-tracker', name: 'Gym Tracker' },
  { id: 'scrum-board', name: 'Scrum Board' },
  { id: 'soumil-mood-tracker', name: 'Soumil Mood Tracker' },
  { id: 'friend-tracker', name: 'Friend Tracker' },
  { id: 'french-translator', name: 'French Translator' },
  { id: 'promo-kit', name: 'Promo Kit' },
];

const EVENTS = [
  { id: 'all', name: 'All Events' },
  { id: 'db.query', name: 'DB Query' },
  { id: 'db.exec', name: 'DB Exec' },
  { id: 'db.query.error', name: 'DB Query Error' },
  { id: 'db.exec.error', name: 'DB Exec Error' },
  { id: 'storage.read', name: 'Storage Read' },
  { id: 'storage.write', name: 'Storage Write' },
  { id: 'storage.delete', name: 'Storage Delete' },
  { id: 'storage.list', name: 'Storage List' },
];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Filter state
  const [appId, setAppId] = useState('all');
  const [event, setEvent] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchLogs = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (appId !== 'all') params.set('app_id', appId);
      if (event !== 'all') params.set('event', event);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      
      const response = await fetch(`/api/audit?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
      }
      
      const data = await response.json();
      setEntries(data.entries || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [appId, event, fromDate, toDate]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString();
  };

  return (
    <Shell title="Audit Logs" subtitle="View system activity and API calls">
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">App</label>
              <select
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
              >
                {APPS.map(app => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Event Type</label>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
              >
                {EVENTS.map(evt => (
                  <option key={evt.id} value={evt.id}>{evt.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button onClick={() => fetchLogs(1)} disabled={loading}>
              {loading ? 'Loading...' : 'Apply Filters'}
            </Button>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Results count */}
        <div className="text-sm text-zinc-600">
          Showing {entries.length} of {pagination.total} entries
        </div>

        {/* Log entries */}
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-zinc-200 bg-white overflow-hidden"
            >
              <button
                onClick={() => toggleRow(entry.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 transition text-left"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-xs text-zinc-500 whitespace-nowrap">
                    {formatTimestamp(entry.ts)}
                  </span>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-zinc-100 text-zinc-700 whitespace-nowrap">
                    {entry.app_id}
                  </span>
                  <span className="text-sm font-medium text-zinc-900 truncate">
                    {entry.event}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-zinc-400 transform transition-transform ${
                    expandedRows.has(entry.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {expandedRows.has(entry.id) && (
                <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50">
                  <pre className="text-xs text-zinc-700 overflow-x-auto">
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => fetchLogs(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              ← Previous
            </Button>
            
            <span className="text-sm text-zinc-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            
            <Button
              variant="secondary"
              onClick={() => fetchLogs(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              Next →
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && !error && (
          <div className="text-center py-12 text-zinc-500">
            No audit logs found matching your filters.
          </div>
        )}
      </div>
    </Shell>
  );
}
