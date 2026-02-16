# Decisions log

- One Next.js host app (no separate Next.js apps)
- Same-process runtime (containers later)
- One SQLite DB per app: `data/apps/<appId>/db.sqlite`
- One storage root per app: `data/apps/<appId>/...`
- Generic SQL API with light guardrails
- Tailwind CSS for UI
