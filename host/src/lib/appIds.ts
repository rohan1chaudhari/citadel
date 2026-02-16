const APP_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;

export function assertAppId(appId: string): asserts appId is string {
  if (!APP_ID_RE.test(appId)) {
    throw new Error(`Invalid appId: ${appId}`);
  }
}
