# Status (living)

## Implemented
- Monorepo created at `/home/rohanchaudhari/personal/citadel`
- Host Next.js skeleton
- App registry reads `apps/*/app.yaml`
- Isolation primitives:
  - per-app SQLite DB file
  - per-app storage root + traversal protection
  - SQL guardrails + audit
- Smart Notes MVP A (capture/list/search/edit/delete)
- Gym Tracker MVP 2 (minimal logging + storage touch)
- Tailwind UI styling + shared UI primitives

## Known issues / notes
- Node built-in `node:sqlite` is experimental (warning is expected).
- Next.js dependency audits show advisories; treat as local-dev only until we bump to a patched version.

## Next priorities (suggested)
- Add proper app-level navigation + empty states polish
- Add delete/edit for Gym entries
- Add Smart Notes full-text search (FTS5) (optional)
- Add auth/device pairing for iPhone hub
