'use client';

import { useState, useMemo } from 'react';

interface Metric {
  id: number;
  category: string;
  label: string;
  value: number;
  unit: string | null;
  created_at: string;
}

interface StatsSummary {
  totalRecords: number;
  categories: string[];
  latestValue: number | null;
  averageValue: number | null;
}

interface DashboardClientProps {
  initialMetrics: Metric[];
  initialSummary: StatsSummary;
}

export function DashboardClient({ initialMetrics, initialSummary }: DashboardClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');

  const filteredMetrics = useMemo(() => {
    if (selectedCategory === 'all') return initialMetrics;
    return initialMetrics.filter((m) => m.category === selectedCategory);
  }, [initialMetrics, selectedCategory]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, Metric[]> = {};
    for (const metric of filteredMetrics) {
      if (!groups[metric.category]) groups[metric.category] = [];
      groups[metric.category].push(metric);
    }
    return groups;
  }, [filteredMetrics]);

  // Calculate simple stats for display
  const stats = useMemo(() => {
    const byCategory: Record<string, { total: number; avg: number; max: number; min: number }> = {};
    
    for (const [cat, items] of Object.entries(groupedByCategory)) {
      const values = items.map((i) => i.value);
      byCategory[cat] = {
        total: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        max: Math.max(...values),
        min: Math.min(...values),
      };
    }
    return byCategory;
  }, [groupedByCategory]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 mb-1">Total Records</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {initialSummary.totalRecords.toLocaleString()}
          </p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 mb-1">Categories</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {initialSummary.categories.length}
          </p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 mb-1">Latest Value</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {initialSummary.latestValue?.toLocaleString() ?? '—'}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500">Filter by category:</span>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-900"
        >
          <option value="all">All Categories</option>
          {initialSummary.categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Category Stats */}
      {Object.entries(stats).map(([category, stat]) => (
        <div 
          key={category}
          className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800"
        >
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3 capitalize">
            {category}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-zinc-500">Total</p>
              <p className="text-lg font-medium">{stat.total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Average</p>
              <p className="text-lg font-medium">{stat.avg.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Max</p>
              <p className="text-lg font-medium">{stat.max.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Min</p>
              <p className="text-lg font-medium">{stat.min.toLocaleString()}</p>
            </div>
          </div>

          {/* Simple Bar Chart */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Trend</p>
            <div className="flex items-end gap-1 h-24">
              {groupedByCategory[category]?.map((metric, idx) => {
                const maxVal = stat.max || 1;
                const heightPercent = (metric.value / maxVal) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-zinc-300 dark:bg-zinc-700 rounded-t hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors relative group"
                    style={{ height: `${Math.max(heightPercent, 5)}%` }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                      {metric.label}: {metric.value.toLocaleString()}
                      {metric.unit ? ` ${metric.unit}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{groupedByCategory[category]?.[0]?.label}</span>
              <span>
                {groupedByCategory[category]?.[groupedByCategory[category].length - 1]?.label}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Data Table */}
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Category</th>
              <th className="text-left px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Label</th>
              <th className="text-right px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Value</th>
              <th className="text-left px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredMetrics.slice(0, 20).map((metric) => (
              <tr key={metric.id} className="hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-2 capitalize">{metric.category}</td>
                <td className="px-4 py-2">{metric.label}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {metric.value.toLocaleString()}
                  {metric.unit ? ` ${metric.unit}` : ''}
                </td>
                <td className="px-4 py-2 text-zinc-500">
                  {new Date(metric.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredMetrics.length > 20 && (
          <p className="px-4 py-2 text-xs text-zinc-500 text-center border-t border-zinc-200 dark:border-zinc-800">
            Showing 20 of {filteredMetrics.length} records
          </p>
        )}
      </div>

      {/* Placeholder for Advanced Charts */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">🚀 Next Steps</h4>
        <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
          This template provides a foundation. Consider adding:
        </p>
        <ul className="text-sm text-blue-800 dark:text-blue-400 list-disc ml-5 space-y-1">
          <li>Recharts for interactive charts (line, bar, pie)</li>
          <li>Date range filtering</li>
          <li>Export to CSV/PDF</li>
          <li>Real-time data updates (WebSocket/SSE)</li>
          <li>Drill-down navigation for detailed views</li>
        </ul>
      </div>
    </div>
  );
}
