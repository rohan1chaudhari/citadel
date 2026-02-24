---
lastAnalyzedCommit: b1e0423295843b1f1d2902e21c9ba6b661635882
lastAnalyzedAt: 2026-02-24T09:09:58+01:00
---

## Summary
Smart Notes is a Next.js App Router notes app backed by app-scoped SQLite (`smart-notes`) with rich-text editing, soft-delete trash, and AI-assisted note creation from photo and voice capture flows.

## Features (IMPLEMENTED)
- Main notes page lists up to 50 active notes (`deleted_at IS NULL`), ordered by pinned first, then most recently updated/created.
- Note cards show title, plain-text preview (HTML stripped), optional tags, and pinned badge.
- New note route (`/apps/smart-notes/new`) reuses a recently-created blank note (last 5 minutes) before creating a new blank row.
- Note editor (`/apps/smart-notes/[id]`) includes:
  - TipTap rich-text body editing
  - debounced autosave (~500ms)
  - `Cmd/Ctrl+S` save shortcut
  - pin/unpin toggle
  - soft-delete flow with confirmation modal
  - transient save-state indicator + error banner
- Unmount cleanup soft-deletes notes that remain empty (no title and no body).
- Trash UI lists deleted notes and supports restore + permanent delete actions.
- Photo note flow:
  - client image capture/upload
  - raw image persisted to app storage (`photos/...`)
  - OpenAI vision extraction/cleanup (`chat/completions`, model `gpt-5.2`)
  - note auto-created and opened
- Voice note flow:
  - browser microphone recording (MediaRecorder)
  - raw audio persisted to app storage (`voice/...`)
  - ElevenLabs STT (`scribe_v1`, `language_code=en`)
  - optional OpenAI restructuring to strict JSON (`responses`, `gpt-4o-mini`)
  - note auto-created and opened
- JSON API supports list/search/create/update/fetch/soft-delete/restore/trash retrieval plus photo/voice ingestion.
- Audit logging is emitted for DB/storage/API events.

## Data Model
Primary table: `notes` (created/migrated by `ensureSmartNotesSchema`)
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `title TEXT`
- `body TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT`
- `deleted_at TEXT`
- `pinned INTEGER NOT NULL DEFAULT 0`
- `tags TEXT`

Indexes:
- `idx_notes_created_at(created_at)`
- `idx_notes_deleted_at(deleted_at)`
- `idx_notes_pinned(pinned)`

## UI Components
- `apps/smart-notes/page.tsx`: notes list shell + quick actions.
- `apps/smart-notes/new/page.tsx`: blank-note reuse/create redirect logic.
- `apps/smart-notes/[id]/page.tsx`: note loader + editor page scaffold.
- `apps/smart-notes/[id]/EditorClient.tsx`: autosave/pin/delete UX and note editing state.
- `components/TiptapEditor.tsx`: toolbar-driven rich text editor (stores HTML output).
- `apps/smart-notes/trash/page.tsx`: deleted notes management.
- `apps/smart-notes/PhotoCaptureButton.tsx`: photo upload trigger + result toast.
- `apps/smart-notes/VoiceCaptureButton.tsx`: record/stop/upload + result/error toast.

## API Routes
- `GET/POST /api/apps/smart-notes/notes`
  - GET: active notes list (+ `q` search across title/body/tags)
  - POST: create note (JSON or form)
- `GET/PATCH/DELETE /api/apps/smart-notes/notes/[id]`
  - GET: fetch one active note
  - PATCH: update title/body/tags/pinned; supports `restore: true`
  - DELETE: soft-delete (`deleted_at` set)
- `POST /api/apps/smart-notes/notes/[id]/delete`: form soft-delete + redirect
- `POST /api/apps/smart-notes/notes/[id]/restore`: form restore + redirect
- `POST /api/apps/smart-notes/notes/[id]/purge`: hard delete + redirect
- `POST /api/apps/smart-notes/notes/[id]/update`: legacy form update route
- `GET /api/apps/smart-notes/trash`: list trashed notes JSON
- `POST /api/apps/smart-notes/photo`: image -> structured markdown note
- `POST /api/apps/smart-notes/voice`: audio -> transcript/structured note

## Technical Notes
- Runtime schema migration is widely used (`ensureSmartNotesSchema`), but `/notes/[id]/update` does not call it.
- Storage is app-scoped and path-confined via `storageWriteBuffer` safeguards.
- Soft delete is default; permanent deletion is explicit (`/purge`).
- Content format is mixed today: editor writes HTML, AI ingest routes write markdown/plain text into the same `body` column.
- API truncates `title` (200) and `tags` (400), but not `body`.
- Voice route hardcodes English transcription unless server logic is changed.

## Enhancement Opportunities
- Unify content representation (HTML vs markdown) or add explicit `content_format` field.
- Improve autosave reliability on tab close/background via flush-on-unload/visibility handling.
- Add first-class search UI on notes page (backend support already exists).
- Add file validation/limits (size, duration, mime edge-cases) for voice/photo uploads.
- Decommission duplicate legacy form routes once no longer used.
- Add optimistic concurrency/version checks to prevent multi-tab overwrites.

## New Feature Opportunities
- Tag chips, tag normalization, and click-to-filter tag views.
- Full-text search (FTS5) with ranked results and snippet highlighting.
- Source metadata panel for AI-created notes (media path, processing model, captured timestamp).
- Bulk trash actions and optional retention-based auto purge.
- Multi-language voice note transcription selection/auto-detect.
- Note linking/backlinks for connected knowledge navigation.
