# Citadel App Extraction Playbook (Agent Self-Guide)

Purpose: repeatable process to extract a built-in Citadel app into a standalone service/project **without data loss**, then validate it end-to-end before reporting success.

---

## 0) Extraction principles

1. **No silent data loss**: copy DB first, never move/delete source DB during initial cutover.
2. **Parity first, refactor later**: keep UI/behavior/API same in first extraction.
3. **One stable upstream**: avoid mixed `dev` + `start` process collisions.
4. **Verify before claiming done**: run health + functional + browser-path checks.

---

## 1) Decide extraction mode

### Mode A — Adapter (fast, no rewrite)
Use when proving gateway/container architecture quickly.
- External service forwards to host app routes.
- Good for early migration.
- Not full decoupling.

### Mode B — True standalone (target)
Use when fully separating app logic/data.
- Independent project/service (Next.js or other).
- Own API routes and storage.
- Registered via manifest + gateway only.

Prefer Mode B for open-source architecture.

---

## 2) Prepare standalone app scaffold

Create under `external-apps/<app-name>-next` (or stack-specific folder).

Minimum files:
- `package.json`
- app source (`app/*` for Next)
- `citadel.app.json`
- `Dockerfile` (optional now, required for container deploy)
- `README.md`
- optional migration scripts (`scripts/copy-db.sh`)

### Manifest template (`citadel.app.json`)
```json
{
  "id": "my-app-external",
  "name": "My App (External)",
  "version": "1.0.0",
  "entry": "/",
  "health": "/api/healthz",
  "permissions": ["microphone", "notifications"]
}
```

---

## 3) Data migration (safe copy, never destructive)

1. Identify source DB (typically `data/apps/<app-id>/db.sqlite`).
2. Copy to external app data dir.
3. Copy WAL/SHM if present.
4. Keep source untouched for rollback.

### Copy script pattern
```bash
SRC_DIR="$ROOT/data/apps/<app-id>"
DST_DIR="$ROOT/external-apps/<external-app>/data"
mkdir -p "$DST_DIR"
cp "$SRC_DIR/db.sqlite" "$DST_DIR/db.sqlite"
[[ -f "$SRC_DIR/db.sqlite-wal" ]] && cp "$SRC_DIR/db.sqlite-wal" "$DST_DIR/db.sqlite-wal"
[[ -f "$SRC_DIR/db.sqlite-shm" ]] && cp "$SRC_DIR/db.sqlite-shm" "$DST_DIR/db.sqlite-shm"
```

If source DB missing, report explicitly (no assumptions).

---

## 4) Register external app in Citadel

Use registration script (`scripts/register-external-<app>.sh`) posting:
- validated manifest
- `upstreamBaseUrl`
- `enabled:true`

Then verify app appears in:
- `GET /api/apps`

---

## 5) Gateway/proxy correctness checklist

Critical for standalone apps behind `/api/gateway/apps/:id/proxy`:

1. **Asset path rewriting for HTML**
   - Ensure `/_next/...` is rewritten to `/api/gateway/apps/<id>/proxy/_next/...`.
2. **No-body statuses**
   - Return no body for `204` and `304` responses.
3. **Header hygiene**
   - strip invalid hop-by-hop headers, preserve useful cache/content headers.
4. **Permission enforcement**
   - keep capability checks in proxy for declared permissions.

---

## 6) Run mode rules (important)

For extracted Next apps, prefer stable mode:
- `npm run build`
- `npm run start -p <port>`

Avoid flaky mixed state:
- do not keep old `next dev` on same port when switching to `next start`.
- if weird chunk/manifest errors appear, kill all on port, clear `.next`, restart clean.

---

## 7) Self-test protocol (must run before reporting)

## A. Process sanity
- Verify only one process on external app port.
- Verify expected command (`next start` or chosen runtime).

## B. Health
- direct: `http://localhost:<port>/api/healthz`
- proxied: `http://localhost:3000/api/gateway/apps/<id>/proxy/api/healthz`

## C. App route
- `http://localhost:3000/apps/<id>` loads and renders.
- hard-refresh does not produce transient 500.

## D. Static assets
- pick one chunk URL from rendered HTML and fetch it via proxy.
- confirm 200 and JS content-type.

## E. Functional smoke
- execute one key user action (e.g., translate `bonjour`, create entry, add note).
- verify response payload and UI update.

## F. Refresh/cache behavior
- test repeated reloads.
- ensure no 304/body proxy errors, no chunk 404s.

---

## 8) Debug playbook for common failures

### Error: `Cannot read properties of undefined (reading 'call')`
Usually JS chunk mismatch (wrong `_next` asset path or mixed build state).
- confirm HTML asset URLs point to proxied upstream chunks.
- clear `.next`, restart clean.

### Error: ENOENT `_document.js` / `pages-manifest.json`
Usually dev/build artifacts corrupted or wrong process mode.
- kill all on port
- clear `.next`
- rebuild
- run `next start`

### Error: `Invalid response status code 304`
Proxy attempted body with 304.
- return `NextResponse(null, {status:304})`.

### Random 404 on `_next/static/*`
Likely wrong asset base rewrite or stale dev process.
- verify rewrite, verify single upstream process.

---

## 9) Completion criteria for extraction

An app is considered successfully extracted when:
1. It runs as independent service/project.
2. Citadel sees it only via manifest + upstream URL.
3. Data copied safely (or explicitly none existed).
4. Key feature parity confirmed.
5. Refresh and proxy asset paths are stable.
6. Rollback path exists (old app untouched until sign-off).

---

## 10) Post-extraction hygiene

- Keep commit scope clear and incremental.
- Update scrum task status + note exactly what was validated.
- Document any deliberate temporary compromises.
- Do not claim “done” without running Section 7 tests.
