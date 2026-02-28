# AUTOPILOT.md

Citadel autopilot runbook (public, current state).

## Scope
- Target board app: `citadel`
- Scrum API base:
  - `SB_BASE=http://localhost:3000/api/gateway/apps/scrum-board/proxy/api/scrum-board`

## Eligibility rules
Pick exactly one task per cycle where:
- `status=todo`
- `attempt_count < max_attempts`
- not actively claimed/locked by another live run

Do **not** auto-pick backlog tasks.

## Execution contract
1. Read selected task + acceptance criteria.
2. If acceptance criteria missing/ambiguous:
   - set task `blocked`
   - write clear clarification questions
   - stop.
3. Implement minimal correct change.
4. Validate at end of run:
   - `npm run build` in `host/`
   - if changed, `npm run build` in affected external app(s)
   - run API/curl smoke checks (or browser smoke if available)
5. Update task status + structured comment.
6. Restart services (required after every completed task):
   - host `:3000`
   - french `:4013`
   - gym `:4014`
   - scrum `:4015`
   - smart-notes `:4016`

## Useful endpoints
- List tasks: `GET ${SB_BASE}/tasks?app=citadel`
- Patch task: `PATCH ${SB_BASE}/tasks`
- Add comment: `POST ${SB_BASE}/comments`
- Sessions: `GET ${SB_BASE}/sessions?appId=citadel`
- Lock status: `GET ${SB_BASE}/lock`
- Trigger run: `POST ${SB_BASE}/trigger`

## Notes
- Clean app IDs are canonical (`scrum-board`, `gym-tracker`, `smart-notes`, `french-translator`).
- Legacy `*-external` URLs are aliases only.
