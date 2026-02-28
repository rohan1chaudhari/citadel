# Archived Internal Apps

The following internal apps were extracted to standalone external apps and removed from the active host tree.

## Archived locally (not in git)
Local archive path:
- `/home/rohanchaudhari/archives/citadel-internal-apps-20260228-012320`

Contains snapshots of:
- `french-translator`
- `gym-tracker`
- `smart-notes`
- `scrum-board`

Each snapshot includes:
- `apps/<id>` manifest/docs
- `host/src/app/apps/<id>` UI routes/components
- `host/src/app/api/apps/<id>` API routes

## Current external replacements
- `french-translator-external` → `external-apps/french-translator-next`
- `gym-tracker-external` → `external-apps/gym-tracker-next`
- `smart-notes-external` → `external-apps/smart-notes-next`
- `scrum-board-external` → `external-apps/scrum-board-next`

## Hidden apps cleanup
Hidden records for removed internal IDs were cleared from `hidden_apps` table to avoid stale hidden entries.
