export function audit(appId: string, event: string, payload: Record<string, unknown> = {}) {
  const rec = { ts: new Date().toISOString(), appId, event, payload };
  console.log(JSON.stringify(rec));
}
