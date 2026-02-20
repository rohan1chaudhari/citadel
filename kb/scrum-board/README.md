# Scrum Board

App ID: `scrum-board`

## Purpose
Task management and autopilot orchestration for Citadel apps.

## Key Files
- `/host/src/app/apps/scrum-board/` — UI
- `/host/src/app/api/apps/scrum-board/` — API routes
- `/host/src/lib/scrumBoardSchema.ts` — Database schema
- `/host/src/lib/triggerAutopilot.ts` — Autopilot trigger logic

## API Endpoints
- `GET /api/apps/scrum-board/tasks?app={appId}` — List tasks
- `PATCH /api/apps/scrum-board/tasks` — Update task
- `POST /api/apps/scrum-board/comments` — Add comment
- `POST /api/apps/scrum-board/trigger` — Trigger autopilot

## Database Tables
- `boards` — Per-app boards
- `tasks` — Tasks with status, priority, etc.
- `comments` — Task comments
- `sessions` — Agent session tracking
- `session_logs` — Session output streaming
- `settings` — Board configuration

## Notes
- scrum-board is a meta-app for managing other apps
- Tasks are scoped per `app_id` via boards
