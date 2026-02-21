# Scrum Board App Knowledge Base

## Architecture

Scrum Board is a meta-app for managing tasks across all Citadel apps.

### Key Concepts
- **Boards**: Each app has its own board (smart-notes, gym-tracker, etc.)
- **Tasks**: Work items with status, priority, acceptance criteria
- **Sessions**: Track agent runs for each task
- **Autopilot**: Scheduled agent that picks up and executes tasks

### File Organization
```
host/src/app/apps/scrum-board/           # UI
host/src/app/api/apps/scrum-board/       # API routes
host/src/lib/scrumBoardSchema.ts         # Database schema
host/src/lib/triggerAutopilot.ts         # Autopilot trigger logic
```

### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| GET /api/apps/scrum-board/tasks?app={appId} | List tasks for an app |
| PATCH /api/apps/scrum-board/tasks | Update task status |
| POST /api/apps/scrum-board/comments | Add comment to task |
| POST /api/apps/scrum-board/trigger | Manually trigger autopilot |
| GET /api/apps/scrum-board/sessions/[id]/stream | SSE stream for live logs |

### Task Status Flow
```
backlog → todo → in_progress → validating → done
                     ↓
               needs_input ← blocked
                     ↓
                    done
```

### Database Schema
- `boards` — Per-app board config
- `tasks` — Main task data
- `comments` — Task discussion
- `sessions` — Agent session tracking
- `session_logs` — Real-time log streaming
- `settings` — Autopilot toggle, etc.

## Agent Lock System
Only one autopilot agent runs at a time. Lock is acquired via:
1. Check `agent_locks` table
2. If free, insert lock with task_id and session_id
3. Lock released when task moves to terminal state

## Session Streaming
The "View Live" feature uses Server-Sent Events:
1. Frontend connects to SSE endpoint
2. Backend polls `session_logs` table every 2s
3. New chunks streamed to client
4. Connection closes when session ends

## Common Issues
- **Resume not working**: Session status must match task status
- **Empty stream**: Session logs written by agent or polling mechanism
- **Agent not picking up tasks**: Check `autopilot_enabled` setting

## Environment Variables
- `OPENAI_API_KEY` — For AI-generated task descriptions
