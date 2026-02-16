const BLOCKED = [/\battach\b/i, /\bdetach\b/i, /\bpragma\b/i, /\bvacuum\b/i];

export function assertSqlAllowed(sql: string) {
  if (sql.includes(';')) throw new Error('Multi-statement SQL is not allowed');
  const s = sql.trim();
  for (const re of BLOCKED) {
    if (re.test(s)) throw new Error('SQL contains blocked keyword');
  }
}
