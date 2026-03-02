const BLOCKED = [/\battach\b/i, /\bdetach\b/i, /\bpragma\b/i, /\bvacuum\b/i, /\bdrop\b/i, /\btruncate\b/i];

export function assertSqlAllowed(sql: string) {
  if (sql.includes(';')) throw new Error('Multi-statement SQL is not allowed');
  const s = sql.trim();
  for (const re of BLOCKED) {
    if (re.test(s)) throw new Error('SQL contains blocked keyword');
  }
  // Block DELETE without a WHERE clause to prevent accidental full-table wipes
  if (/^\s*delete\s+from\b/i.test(s) && !/\bwhere\b/i.test(s)) {
    throw new Error('DELETE without WHERE clause is not allowed');
  }
}
