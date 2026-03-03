# App Extraction Cutover Plan (Phase 2)

This is the execution plan for extracting built-in apps to standalone repositories **without data loss**.

## Global rules

- Extract **one app at a time**.
- No extraction if working tree is dirty.
- Never delete `data/apps/<appId>/` during extraction.
- Always verify export archives before any uninstall/reinstall step.

## Pre-flight (run once)

```bash
cd /home/rohanchaudhari/personal/citadel

# 1) Clean working tree
git status --porcelain

# 2) Host health
curl -s http://localhost:3000/api/health

# 3) Ensure backups dir exists
mkdir -p data/backups/manual
```

---

## Per-app cutover checklist (repeat per app)

Use this exact sequence for each app.

### Step A — Snapshot current state

```bash
APP_ID="smart-notes"   # change per app

# Record DB metadata + table counts
sqlite3 "data/apps/${APP_ID}/db.sqlite" ".tables"
sqlite3 "data/apps/${APP_ID}/db.sqlite" "SELECT name FROM sqlite_master WHERE type='table';"
```

### Step B — Export backup (required)

```bash
# Export through host API
curl -sS "http://localhost:3000/api/apps/${APP_ID}/export" -o "data/backups/manual/${APP_ID}-pre-extract-$(date -u +%Y%m%dT%H%M%SZ).zip"

# Verify archive integrity
unzip -t "data/backups/manual/${APP_ID}-pre-extract-"*.zip
```

### Step C — Prepare standalone repo

Target repository should contain:
- `app.yaml`
- `migrations/`
- UI/API routes
- `README.md`

### Step D — Install standalone app via CLI

```bash
# Example URL; replace with real repo
node scripts/citadel-app.mjs install "https://github.com/rohan1chaudhari/citadel-${APP_ID}"
```

### Step E — Verify runtime + data continuity

```bash
# App route responds
curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3000/apps/${APP_ID}"

# Health remains OK
curl -s http://localhost:3000/api/health

# DB file still present
ls -la "data/apps/${APP_ID}/db.sqlite"
```

### Step F — Optional restore drill (recommended)

In a non-prod/dev clone, test restore from the export zip to verify recovery path.

### Step G — Mark cutover complete

Record:
- export file name
- repo URL
- validation results
- any migration notes

---

## Extraction order (low risk → high risk)

1. `french-translator`
2. `friend-tracker`
3. `soumil-mood-tracker`
4. `promo-kit`
5. `task-manager`
6. `gym-tracker`
7. `smart-notes`
8. `scrum-board` (last)

---

## App-by-app tracker

| App | Repo URL | Export verified | Install verified | Data continuity verified | Status |
|---|---|---|---|---|---|
| french-translator | https://github.com/rohan1chaudhari/citadel-french-translator | ☑ | ☑ | ☑ | cutover complete (2026-03-03) |
| friend-tracker | https://github.com/rohan1chaudhari/citadel-friend-tracker | ☑ | ☑ | ☑ | cutover complete (2026-03-03) |
| soumil-mood-tracker | https://github.com/rohan1chaudhari/citadel-soumil-mood-tracker | ☑ | ☑ | ☑ | cutover complete (2026-03-03) |
| promo-kit | https://github.com/rohan1chaudhari/citadel-promo-kit | ☑ | ☑ | ☑ | cutover complete (2026-03-03) |
| task-manager | https://github.com/rohan1chaudhari/citadel-task-manager | ☑ | ☑ | ☑ | cutover complete (2026-03-03) |
| gym-tracker | https://github.com/rohan1chaudhari/citadel-gym-tracker | ☑ | ☑ | ☑ | cutover complete (2026-03-03) |
| smart-notes | https://github.com/rohan1chaudhari/citadel-smart-notes | ☑ | ☑ | ☑ | cutover complete (2026-03-03) |
| scrum-board | https://github.com/rohan1chaudhari/citadel-scrum-board | ☑ | ☐ | ☐ | blocked: protected app (cannot uninstall via CLI) |

---

## Fast rollback

If an extraction fails:

1. Stop and do not continue to next app.
2. Restore app data from latest verified export.
3. Reinstall previous known-good app source.
4. Validate app route + DB presence.

```bash
# Example rollback restore endpoint usage (if import API is enabled)
# curl -X POST -F "file=@backup.zip" "http://localhost:3000/api/apps/${APP_ID}/import"
```
