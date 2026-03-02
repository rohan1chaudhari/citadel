'use client';

import { useEffect, useState } from 'react';

type WidgetData = {
  appId: string;
  title: string;
  data: string;
};

export function WidgetSection({ apps }: { apps: { id: string; name: string; widget?: boolean }[] }) {
  const [widgets, setWidgets] = useState<WidgetData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter apps that have widgets enabled
  const widgetApps = apps.filter((app) => app.widget);

  useEffect(() => {
    async function loadWidgets() {
      if (widgetApps.length === 0) {
        setLoading(false);
        return;
      }

      const widgetData: WidgetData[] = [];

      for (const app of widgetApps) {
        try {
          const res = await fetch(`/api/apps/${app.id}/widget`);
          if (res.ok) {
            const json = await res.json();
            if (json.ok) {
              widgetData.push({
                appId: app.id,
                title: json.title || app.name,
                data: json.data || '',
              });
            }
          }
        } catch (err) {
          // Silently skip widgets that fail to load
          console.warn(`Failed to load widget for ${app.id}:`, err);
        }
      }

      setWidgets(widgetData);
      setLoading(false);
    }

    loadWidgets();
  }, [apps]);

  if (widgetApps.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="mt-8 mb-4">
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">Widgets</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {widgetApps.map((app) => (
            <div
              key={app.id}
              className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 h-20 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (widgets.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 mb-4">
      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">Widgets</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {widgets.map((widget) => (
          <a
            key={widget.appId}
            href={`/apps/${widget.appId}`}
            className="bg-white dark:bg-zinc-900 rounded-lg p-3 shadow-sm border border-zinc-200 dark:border-zinc-800 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
          >
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
              {widget.title}
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate mt-1">
              {widget.data}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
