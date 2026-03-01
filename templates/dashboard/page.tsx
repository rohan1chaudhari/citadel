import { Shell, Card } from '@/components/Shell';
import { dbQuery } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';
import { DashboardClient } from './DashboardClient';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

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

export default async function {{AppName}}Page() {
  await requirePermissionConsent(APP_ID);

  // Fetch all metrics
  const metrics = dbQuery<Metric>(
    APP_ID,
    `SELECT id, category, label, value, unit, created_at 
     FROM metrics 
     ORDER BY category, created_at ASC`
  );

  // Calculate summary stats
  const categories = [...new Set(metrics.map((m) => m.category))];
  const values = metrics.map((m) => m.value);
  const latestValue = values.length > 0 ? values[values.length - 1] : null;
  const averageValue = values.length > 0 
    ? values.reduce((a, b) => a + b, 0) / values.length 
    : null;

  const summary: StatsSummary = {
    totalRecords: metrics.length,
    categories,
    latestValue,
    averageValue,
  };

  // Serialize to handle BigInt
  const serializedMetrics = JSON.parse(
    JSON.stringify(metrics, (k, v) => (typeof v === 'bigint' ? Number(v) : v))
  );
  const serializedSummary = JSON.parse(
    JSON.stringify(summary, (k, v) => (typeof v === 'bigint' ? Number(v) : v))
  );

  return (
    <Shell title="{{app_name}}" subtitle="Data visualization dashboard">
      <DashboardClient 
        initialMetrics={serializedMetrics} 
        initialSummary={serializedSummary}
      />
    </Shell>
  );
}
