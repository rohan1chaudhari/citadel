# Roadmap — Smart Notes

## v0.1 (DONE)
- Create note (title/body)
- List recent notes
- Search (simple LIKE)
- Edit + delete

## v0.2 (Polish + quality)
- Note detail page (`/apps/smart-notes/<id>`) + clean list view
- Better search UX (highlight matches, keep query in URL)
- Input validation + nice error states
- Soft delete / trash (optional)

## v0.3 (Power features)
- Tags (many-to-many) + filter
- Pin/star notes
- Basic markdown rendering (optional)

## v0.4 (Performance + retrieval)
- SQLite FTS5 for full-text search
- “Related notes” (heuristic: shared tags + recency)

## v0.5 (Context surfacing)
- “Today” view that suggests notes based on:
  - recency, frequency, pinned
  - optional context signals (time-of-day, location) — only if user approves
