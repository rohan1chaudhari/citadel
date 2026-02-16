# Citadel — Project Knowledge Base

Citadel is a **local-first personal app hub**: one Next.js host that serves multiple isolated “apps” (Smart Notes, Gym Tracker, etc.) under a single deployment.

## Core decisions (MVP)
- **Single Next.js host app** (no separate Next.js apps per module)
- **Same-process runtime** (no per-app containers yet)
- **Isolation** via:
  - **1 SQLite DB file per app**: `data/apps/<appId>/db.sqlite`
  - **1 storage root per app**: `data/apps/<appId>/...`
- **Generic SQL API** exposed internally, but **host-enforced** (apps don’t get DB access directly)
- **Light SQL guardrails**:
  - block multi-statement (`;`)
  - block obvious escape hatches (`ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`)
- **Audit**: MVP logs JSON records to stdout

## Repo layout
- `host/` — Next.js app host (UI routes + API routes + isolation enforcement)
- `apps/` — app manifests (`app.yaml`) + placeholder app packages
- `core/` — platform spec / shared concepts
- `data/` — runtime data (gitignored)
- `kb/` — this knowledge base

## How to run
```bash
cd /home/rohanchaudhari/personal/citadel/host
npm install
npm run dev
# open http://localhost:3000
```

## Current apps
- `smart-notes`
  - UI: `/apps/smart-notes`
  - API: `/api/apps/smart-notes/notes` (+ update/delete)
- `gym-tracker`
  - UI: `/apps/gym-tracker`
  - API: `/api/apps/gym-tracker/entries`

## Notion
Project is tracked in Notion (project home + tasks + specs). Keep the canonical roadmap there; keep implementation details and “how it works” here.
