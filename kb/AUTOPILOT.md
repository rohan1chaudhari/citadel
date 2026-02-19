# Citadel Autopilot

**Goal:** One scheduled run = one task executed safely.

## Scope
Apps: `smart-notes`, `gym-tracker`, `soumil-mood-tracker`, `scrum-board`

Task statuses: `todo` → `in_progress` → `done`/`needs_input`/`blocked`/`failed`

## Inputs (cron must provide)
- `app_id`, `app_name`, `cron_job_id`, `cron_run_ts`
- `repo_path` (default: `/home/rohanchaudhari/personal/citadel`)
- `force_task_id` (optional)

## Block Conditions (stop + comment `[AUTOPILOT_BLOCKED]`)
- No acceptance criteria
- Needs secrets/credentials/payments/production deploy
- Destructive data ops without approval
- Broad architecture changes not scoped
- Uncommitted changes that make attribution unsafe

## Task Selection
From Scrum Board for target app only:
- Eligible: `status=todo`, `attempt_count < max_attempts`, not claimed
- Rank by: highest `priority` → oldest `created_at` → lowest `id`

## Claim (before coding)
1. Move task to `in_progress`
2. Set: `claimed_by: autopilot`, `claimed_at: <iso>`, `last_run_at: <iso>`, `session_id: <key>`

## Execute
1. Read task + acceptance criteria
2. Implement minimally
3. Validate: `npm run build` in `host/`
4. Mark result

## Completion
| Result | Action |
|--------|--------|
| Success | Move to `done`, comment `[AUTOPILOT_DONE]` |
| Needs human | Move to `needs_input`, comment `[AUTOPILOT_NEEDS_INPUT]` |
| Blocked external | Move to `blocked`, comment `[AUTOPILOT_BLOCKED]` |
| Failed | Increment `attempt_count`, move to `todo` (or `failed` if max reached), comment `[AUTOPILOT_FAILED]` |

## Comment Template
```
[AUTOPILOT_DONE]
app_id: <id>
task_id: <id>
cron_job_id: <id>
cron_run_ts: <ts>

summary: <what was done>
files_changed: <paths>
validation: <command + result>
commit: <sha> <message>
```

## Git
- Commit format: `autopilot(<app_id>): <task title>`
- Only task-related changes

## Trace Tuple (record always)
`cron_job_id` + `cron_run_ts` + `app_id` + `task_id` + `session_id`

## Stop Rule
Exactly one task per run. Stop after first completion/block/fail.
