# CRON.md

## Recurring autopilot job
- Name: `autopilot-citadel-recurring`
- Schedule: every 15 minutes
- Behavior: one eligible task per run, otherwise idle with `NO_ELIGIBLE_TASKS`

## Operational expectations
- If there are no `todo` tasks, recurring runs should idle.
- If task is stuck `in_progress` without lock/session progress, reset manually to `todo`.
- Backlog items are intentionally not auto-picked.

## Helpful commands
```bash
openclaw cron list --json
openclaw cron remove <job-id>
openclaw cron add --name "autopilot-citadel-recurring" --every 15m ...
```

## Manual unstick playbook
1. Check lock: `GET /api/.../scrum-board/lock`
2. If stale lock/session, clear lock and close stale session.
3. Reset stuck task to `todo` if appropriate.
