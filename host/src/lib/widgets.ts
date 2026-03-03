import { dbQuery } from '@citadel/core';

export type WidgetPayload = {
  title: string;
  data: string;
};

/**
 * Generate default widget data based on app activity.
 */
export async function getDefaultWidgetData(appId: string, appName: string): Promise<WidgetPayload> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = dbQuery<{ count: number }>(
      'citadel',
      `SELECT COUNT(*) as count FROM audit_log
       WHERE app_id = ? AND ts >= ?`,
      [appId, today]
    );
    const count = rows[0]?.count ?? 0;

    if (count > 0) {
      return {
        title: appName,
        data: `${count} actions today`,
      };
    }
  } catch {
    // Audit log might not exist yet; silently fall back.
  }

  return {
    title: appName,
    data: 'Ready',
  };
}
