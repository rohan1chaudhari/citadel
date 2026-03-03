import { NextResponse } from 'next/server';
import { getHostStatus, verifyAppDatabases, dataRoot, dbQuery } from '@citadel/core';
import { statfs } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

async function getDiskUsage() {
  try {
    const dataDir = dataRoot();
    const stats = await statfs(dataDir);
    const total = stats.blocks * stats.bsize;
    const available = stats.bavail * stats.bsize;
    const used = total - available;
    return {
      total,
      used,
      available,
      percentUsed: Math.round((used / total) * 100 * 100) / 100,
      path: dataDir,
    };
  } catch (e) {
    return null;
  }
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
  };
}

function getRecentErrors(limit: number = 10) {
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const cutoff = oneDayAgo.toISOString();

    const results = dbQuery<
      { id: number; ts: string; app_id: string; event: string; payload: string }
    >(
      'citadel',
      `SELECT id, ts, app_id, event, payload 
       FROM audit_log 
       WHERE (event LIKE '%error%' OR event LIKE '%failed%' OR event LIKE '%fail%' OR payload LIKE '%error%')
         AND ts > ?
       ORDER BY ts DESC
       LIMIT ?`,
      [cutoff, limit]
    );

    return results.map((r) => ({
      id: r.id,
      ts: r.ts,
      appId: r.app_id,
      event: r.event,
      payload: JSON.parse(r.payload || '{}'),
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const status = getHostStatus();
  const [dbErrors, diskUsage, memoryUsage, recentErrors] = await Promise.all([
    verifyAppDatabases(),
    getDiskUsage(),
    Promise.resolve(getMemoryUsage()),
    Promise.resolve(getRecentErrors(10)),
  ]);

  const isHealthy = dbErrors.length === 0;

  return NextResponse.json(
    {
      ok: isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      node: {
        version: process.version,
        uptimeMs: status.uptimeMs,
        uptimeSec: Math.floor(status.uptimeMs / 1000),
      },
      host: {
        ready: status.ready,
        startupDurationMs: status.startupDurationMs,
        openConnections: status.openConnections,
      },
      disk: diskUsage,
      memory: memoryUsage,
      databases: {
        checked: dbErrors.length === 0 ? 'all' : 'partial',
        errors: dbErrors.length > 0 ? dbErrors : undefined,
      },
      recentErrors: recentErrors.length > 0 ? recentErrors : undefined,
    },
    {
      status: isHealthy ? 200 : 503,
    }
  );
}
