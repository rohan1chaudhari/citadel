type AppItem = {
  id: string;
  name: string;
  widget?: boolean;
};

type WidgetData = {
  appId: string;
  title: string;
  data: string;
};

type WidgetResponse = {
  ok: boolean;
  title?: string;
  data?: string;
};

export async function WidgetSection({ apps }: { apps: AppItem[] }) {
  const widgetApps = apps.filter((app) => app.widget);

  if (widgetApps.length === 0) {
    return null;
  }

  const settled = await Promise.allSettled(
    widgetApps.map(async (app): Promise<WidgetData> => {
      const response = await fetch(`http://localhost:3000/api/apps/${app.id}/widget`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Widget endpoint unavailable for ${app.id}`);
      }

      const payload = (await response.json()) as WidgetResponse;
      if (!payload.ok || !payload.title || payload.data === undefined) {
        throw new Error(`Invalid widget payload for ${app.id}`);
      }

      return {
        appId: app.id,
        title: payload.title,
        data: payload.data,
      };
    })
  );

  const widgets = settled
    .filter((r): r is PromiseFulfilledResult<WidgetData> => r.status === 'fulfilled')
    .map((r) => r.value);

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
