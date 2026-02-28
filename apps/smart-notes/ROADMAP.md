# Smart Notes — App Roadmap

## Polish
- [ ] Unify content format (HTML vs markdown — pick one or add `content_format` field)
- [ ] Search UI on notes list page (backend already supports `q` param)
- [ ] Tag chips with click-to-filter
- [ ] Autosave reliability on tab close / background (visibility API flush)
- [ ] Note sorting options (date, alphabetical, last edited)

## New Features
- [ ] Full-text search (FTS5) with ranked results and snippet highlighting
- [ ] Note linking / backlinks for connected knowledge navigation
- [ ] Source metadata panel for AI-created notes (media path, model, timestamp)
- [ ] Bulk trash actions and optional retention-based auto-purge
- [ ] Multi-language voice note transcription

## Tech Debt
- [ ] Decommission duplicate legacy form routes
- [ ] Add file validation/limits for voice/photo uploads (size, duration, MIME)
- [ ] Optimistic concurrency / version checks to prevent multi-tab overwrites
