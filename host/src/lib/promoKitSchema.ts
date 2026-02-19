import { dbExec, dbQuery } from '@/lib/db';

const APP_ID = 'promo-kit';

export type PostStatus = 'draft' | 'ready' | 'posted';
export type PostPlatform = 'twitter' | 'linkedin' | 'both';

export function ensurePromoKitSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'both',
      status TEXT NOT NULL DEFAULT 'draft',
      image_prompt TEXT,
      image_path TEXT,
      commit_refs TEXT,
      posted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  );

  dbExec(
    APP_ID,
    `CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)`
  );
  dbExec(
    APP_ID,
    `CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform)`
  );
  dbExec(
    APP_ID,
    `CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)`
  );
}

export function normalizeStatus(v: unknown): PostStatus {
  const x = String(v ?? '').trim().toLowerCase();
  if (x === 'draft' || x === 'ready' || x === 'posted') return x;
  return 'draft';
}

export function normalizePlatform(v: unknown): PostPlatform {
  const x = String(v ?? '').trim().toLowerCase();
  if (x === 'twitter' || x === 'linkedin') return x;
  return 'both';
}
