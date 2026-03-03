# Extract Apps Safely (P3-14)

Use this runbook when moving apps from the monorepo into standalone repositories.

## Why this matters

App extraction should **not** risk user data. App code can move repos; app data stays under `data/apps/<appId>/`.

## Safe extraction flow

### 1) Freeze scope
- Extract one app at a time.
- Avoid concurrent schema or route refactors during extraction.

### 2) Backup first (required)
- Export app data (`/api/apps/<appId>/export`) and verify archive opens.
- Keep one backup copy outside the current machine.

### 3) Create target app repo
- Initialize standalone repo for the app.
- Keep required structure:
  - `app.yaml`
  - `migrations/`
  - UI/API routes
  - `README.md`

### 4) Install via CLI (not manual copy)
```bash
node scripts/citadel-app.mjs install <repo-url>
```
This guarantees route sync, registration, and migration hooks run.

### 5) Verify runtime behavior
- Open app UI under `/apps/<appId>`
- Exercise key API routes
- Confirm hot reload works (dev)
- Run host build

### 6) Verify data continuity
- Confirm existing `data/apps/<appId>/db.sqlite` is still present
- Check row counts before/after extraction for key tables
- Restore from backup in dry-run environment once

### 7) Remove monorepo copy only after verification
- Keep fallback branch/tag until post-extraction checks pass.

## Anti-data-loss guardrails

- Never delete `data/apps/*` in extraction scripts.
- Never use recursive delete on app data paths without explicit backup confirmation.
- Treat `--delete-data` as destructive and manual-only.

## Quick verification commands

```bash
# health
curl -s http://localhost:3000/api/health

# task/app list sanity
curl -s "http://localhost:3000/api/apps/scrum-board/tasks?app=citadel"

# DB presence check
ls -la data/apps/<appId>/db.sqlite
```
