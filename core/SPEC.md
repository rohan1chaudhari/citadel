# Citadel Platform Spec (MVP)

## Architecture choice (MVP)
- **Single Next.js app** acts as:
  - Control plane (registry, orchestration)
  - Runtime host (serves app UI + app APIs)
- **Same-process runtime** (no per-app containers yet)
- **SQLite** for data storage

## App boundaries
Apps do not get raw DB credentials or direct filesystem access.
They may only use host-exposed APIs.

## Isolation (hard rules)
### Database
- **One SQLite DB file per app**:
  - Path: `/data/apps/<app_id>/db.sqlite`
  - Host selects the DB file strictly by `app_id`.
  - No cross-app queries/joins in MVP.

### Storage
- Per-app storage root:
  - `/data/apps/<app_id>/`
- Host enforces path scoping and blocks traversal (`../`).

### Network / connectors
- Apps do not call external services directly (MVP).
- Any future connectors are host-owned and permission-gated.

## Permissions (deny-by-default)
- Each app ships `app.yaml` declaring scopes.
- New scopes require explicit user approval + enforcement + audit.

## Orchestration
Lifecycle:
1) validate manifest
2) build
3) migrate
4) deploy
5) healthcheck
6) rollback

## Host APIs (MVP decision)
- Expose a **generic, host-enforced SQL API** to app code:
  - `db.query(appId, sql, params)`
  - `db.exec(appId, sql, params)`
- Guardrails (must-have):
  - host chooses DB file by appId (no override)
  - parameterized queries only
  - optional SQL allowlist for MVP (SELECT/INSERT/UPDATE/DELETE/CREATE TABLE/CREATE INDEX)
  - audit every call (appId + query type + tables affected)

- `storage.read/write/list(appId, path)`
- `audit.log(appId, eventType, payload)`
- `storage.read/write/list(appId, path)`
- `audit.log(appId, eventType, payload)`
