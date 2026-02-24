---
lastAnalyzedCommit: b1e0423295843b1f1d2902e21c9ba6b661635882
lastAnalyzedAt: 2026-02-24T08:52:56+01:00
---

## Summary
Smart Notes is a server-rendered Next.js app with a rich-text editor and SQLite-backed note storage scoped under app id `smart-notes`. It supports standard note CRUD with autosave, pinning, soft-delete trash flows, plus AI-assisted photo-to-note and voice-to-note creation.

## Features (IMPLEMENTED)
- Notes list page with latest 50 active notes, ordered by pinned then last updated/created.
- Rich note editor page (`/apps/smart-notes/[id]`) with:
  - Debounced autosave (500ms) via `PATCH /api/apps/smart-notes/notes/[id]`
  - Manual save shortcut (`Cmd/Ctrl+S`)
  - Pin/unpin toggle
  - Soft delete with confirmation modal
  - Error/status indicators (Saving/Saved/Error/Unsaved)
- New note flow (`/apps/smart-notes/new`) that reuses a recent blank note (<5 min) before creating another.
- Empty-note cleanup on editor unmount (auto-soft-delete when title/body both empty).
- Trash UI (`/apps/smart-notes/trash`) with restore and permanent delete actions.
- Photo note capture button:
  - Upload image
  - Persist raw image to app storage
  - OCR/structuring via OpenAI chat completions (`gpt-5.2`)
  - Auto-create note from extracted markdown and redirect to editor
- Voice note capture button:
  - In-browser recording via MediaRecorder
  - Persist raw audio to app storage
  - Transcription via ElevenLabs STT (`scribe_v1`)
  - Optional markdown/title structuring via OpenAI Responses (`gpt-4o-mini`) with fallback formatting
  - Auto-create note and redirect to editor
- JSON APIs for listing/searching notes and trash retrieval.
- Audit events emitted for create/update/delete/restore/purge/photo/voice actions.

## Data Model
`notes` table (auto-migrated in `ensureSmartNotesSchema`):
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `title TEXT`
- `body TEXT` (stores rich-text HTML from TipTap for manual editing; AI pipelines may insert markdown/plain text)
- `created_at TEXT NOT NULL` (ISO strings)
- `updated_at TEXT` (added via migration)
- `deleted_at TEXT` (soft-delete marker)
- `pinned INTEGER NOT NULL DEFAULT 0`
- `tags TEXT`

Indexes:
- `idx_notes_created_at(created_at)`
- `idx_notes_deleted_at(deleted_at)`
- `idx_notes_pinned(pinned)`

## UI Components
- `apps/smart-notes/page.tsx`: main list, quick actions (Trash, Photo Note, Voice Note, New Note), HTML-stripped preview rendering.
- `apps/smart-notes/[id]/page.tsx`: note loader + full-width editor layout.
- `apps/smart-notes/[id]/EditorClient.tsx`: client editing logic, autosave lifecycle, pin/delete UX.
- `components/TiptapEditor.tsx`: rich text toolbar (bold/italic/code/headings/lists/quote/code block/undo/redo), outputs HTML.
- `apps/smart-notes/new/page.tsx`: blank note creation/reuse redirector.
- `apps/smart-notes/trash/page.tsx`: deleted-note listing with restore/purge forms.
- `PhotoCaptureButton.tsx` and `VoiceCaptureButton.tsx`: capture/upload UX and status toasts.

## API Routes
- `GET/POST /api/apps/smart-notes/notes`
  - GET supports optional `q` search over title/body/tags.
  - POST creates note (JSON or form mode).
- `GET/PATCH/DELETE /api/apps/smart-notes/notes/[id]`
  - GET active note
  - PATCH update fields or restore (`{ restore: true }`)
  - DELETE soft-delete
- `POST /api/apps/smart-notes/notes/[id]/restore` (form-based restore + redirect)
- `POST /api/apps/smart-notes/notes/[id]/purge` (hard delete + redirect)
- `POST /api/apps/smart-notes/notes/[id]/delete` (form-based soft delete + redirect)
- `POST /api/apps/smart-notes/notes/[id]/update` (legacy form update route)
- `GET /api/apps/smart-notes/trash` (JSON list of deleted notes)
- `POST /api/apps/smart-notes/photo` (image upload, AI extraction, note creation)
- `POST /api/apps/smart-notes/voice` (audio upload, STT + optional LLM structuring, note creation)

## Technical Notes
- Schema creation/migration is done lazily at runtime by pages/routes calling `ensureSmartNotesSchema()`.
- Soft-delete is consistently used for normal deletion; purge is explicit and separate.
- Title/tags lengths are bounded in APIs; body is unbounded text/HTML.
- Mixed content format risk: editor saves HTML, while AI pipelines insert markdown/plain text into same `body` field.
- `new/page.tsx` performs an unnecessary second `dbExec` call for `SELECT last_insert_rowid()` (works, but atypical).
- `notes/[id]/update` route does not call schema ensure helper unlike most other routes.
- Voice transcription is forced to English (`language_code: en`) in current implementation.

## Enhancement Opportunities
- Normalize note body representation (HTML vs markdown) with explicit `content_format` field or conversion layer.
- Add optimistic concurrency/versioning to reduce overwrite risk during rapid edits/multi-tab usage.
- Add note search/filter UI controls (currently search exists in API but not exposed in page UI).
- Improve autosave robustness (flush save on unmount/page hide; cancel delete-on-unmount when navigation race occurs).
- Add validation + size limits for audio uploads similar to image type checks.
- Consolidate legacy form routes (`/update`, `/delete`) or clearly mark compatibility layer.

## New Feature Opportunities
- Smart extraction metadata for AI-created notes (source type, original media path, confidence markers).
- Tag chips + structured tags model with quick filtering and autocomplete.
- Note linking/backlinks and lightweight graph view for connected thoughts.
- Full-text index (SQLite FTS5) for faster, relevance-ranked search across large note sets.
- Bulk trash actions and retention policy (auto-purge after N days with undo window).
- Voice language auto-detection and configurable transcription language/profile.