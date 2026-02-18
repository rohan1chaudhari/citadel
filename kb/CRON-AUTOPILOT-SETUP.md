# Cron setup blueprint (Citadel Autopilot)

Use this as the canonical setup for scheduled autopilot runs.

---

## Scheduling strategy

Run one isolated agent job per app, staggered to avoid overlap.

Recommended:
- `smart-notes` → `0 * * * *`
- `gym-tracker` → `20 * * * *`
- `soumil-mood-tracker` → `40 * * * *`
- optional `scrum-board` maintenance → `0 */6 * * *`

All jobs should use:
- `sessionTarget: "isolated"`
- `payload.kind: "agentTurn"`
- `notify: true`

---

## Standard agentTurn message template

```text
Autopilot cycle for Citadel app: <app_name> (<app_id>)

Context:
- Repo: /home/rohanchaudhari/personal/citadel
- Runbook: /home/rohanchaudhari/personal/citadel/kb/AUTOPILOT.md
- Target app_id: <app_id>

Execution contract:
1) Read AUTOPILOT.md and follow it strictly.
2) Read scrum-board tasks for this app only.
3) Pick highest-priority eligible task in status `todo` with attempt_count < max_attempts.
4) Claim task (set status `in_progress`, set claimed_by/claimed_at/last_run_at/session_id).
5) Implement exactly one task.
6) Validate with `npm run build` in /home/rohanchaudhari/personal/citadel/host.
7) Update task:
   - done if complete + validated
   - needs_input if human decision required
   - blocked if external dependency
   - failed if retries exhausted; else increment attempt_count and return to todo
8) Add structured comment with debug metadata and stop.
```

---

## Per-app job payloads

### Smart Notes
- `app_id`: `smart-notes`
- `app_name`: `Smart Notes`
- schedule: `0 * * * *`

### Gym Tracker
- `app_id`: `gym-tracker`
- `app_name`: `Gym Tracker`
- schedule: `20 * * * *`

### Soumil Mood Tracker
- `app_id`: `soumil-mood-tracker`
- `app_name`: `Soumil Mood Tracker`
- schedule: `40 * * * *`

---

## Safety/ops notes

1. Keep runs staggered so only one app run is likely active at once.
2. Never process more than one task per run.
3. Require claim metadata before any code changes.
4. If task is ambiguous, move to `needs_input` and stop.
5. Always include debug trace fields in final comment.
