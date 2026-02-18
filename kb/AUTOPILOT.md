# Citadel Autopilot Runbook

**Purpose:** Let scheduled OpenClaw runs safely pick and execute exactly one high-priority task per app, then report traceable results.

---

## 0) Scope

This runbook applies to these apps:
- `smart-notes`
- `gym-tracker`
- `soumil-mood-tracker`
- `scrum-board` (board maintenance tasks only)

Autopilot executes **one task per run**.

### Scrum task status lifecycle
- `todo` → queued
- `in_progress` → currently being executed
- `needs_input` → waiting for human decision/input
- `blocked` → external dependency blocks progress
- `done` → validated complete
- `failed` → exhausted retries or hard failure

---

## 1) Inputs expected by each cron run

Each cron-triggered agent message must include:
1. `app_id` (required)
2. `app_name` (required)
3. `cron_job_id` (required)
4. `cron_run_ts` (required, ISO timestamp)
5. `repo_path` (default: `/home/rohanchaudhari/personal/citadel`)
6. `run_mode` (`normal` by default)

Optional:
- `force_task_id` (if set, use this exact task instead of selecting one)

---

## 2) Hard safety rules

Autopilot MUST stop and comment instead of proceeding if any of these are true:

1. No clear acceptance criteria in selected task.
2. Task requires secrets, credentials, payments, external account actions, or production deployment.
3. Task implies destructive data operations without explicit approval.
4. Task requires broad architecture changes not scoped in the card.
5. Working tree has unrelated uncommitted changes that make attribution unsafe.

When blocked, add a comment with prefix: `[AUTOPILOT_BLOCKED]`.

---

## 3) Task selection policy

### Board source
Use Scrum Board data for the target app only.

### Eligible tasks
A task is eligible only if:
- status is `todo`
- app matches `app_id`
- not already claimed by another active autopilot run
- `attempt_count < max_attempts`

### Ranking
Pick top by:
1. highest `priority` value (descending)
2. oldest `created_at` (ascending)
3. lowest `id` (ascending)

If `force_task_id` is provided, skip ranking and use it.

---

## 4) Claim protocol (anti-collision)

Before coding:
1. Move task to `in_progress`
2. Add/append claim metadata fields:
   - `claimed_by: autopilot`
   - `claimed_at: <now-iso>`
   - `last_run_at: <now-iso>`
   - `session_id: <agent_session_key_or_empty>`

If claim fails, stop run.

---

## 5) Execution protocol

1. Read task description + acceptance criteria.
2. Implement only what is needed to satisfy the task.
3. Keep changes minimal and app-scoped.
4. Run validation (section 6).
5. If validation fails, do not mark done.

---

## 6) Validation protocol

Minimum required validation:
1. `npm run build` in `host/`

When relevant, also run:
- targeted checks/tests for changed area
- smoke API call or route-level sanity check

Validation result must be recorded in task comment.

---

## 7) Completion protocol

If successful:
1. Move task to `done`
2. Add completion comment prefixed with `[AUTOPILOT_DONE]`
3. Include all fields in section 8

If human input is required:
1. Move task to `needs_input`
2. Set `needs_input_questions` with explicit questions/options
3. Add comment prefixed `[AUTOPILOT_NEEDS_INPUT]`

If externally blocked:
1. Move task to `blocked`
2. Add comment prefixed `[AUTOPILOT_BLOCKED]`

If unsuccessful:
1. Increment `attempt_count`
2. If `attempt_count < max_attempts`, move task back to `todo`
3. Else move task to `failed`
4. Add comment prefixed `[AUTOPILOT_FAILED]`
5. Include failure reason + next step

---

## 8) Mandatory comment template

Use this exact structure in Scrum comments:

```md
[AUTOPILOT_DONE]
app_id: <app_id>
app_name: <app_name>
task_id: <task_id>
cron_job_id: <cron_job_id>
cron_run_ts: <cron_run_ts>
agent_session_key: <session_key_or_unknown>

summary:
- <what was implemented>
- <key decisions>

files_changed:
- <path>
- <path>

validation:
- command: npm run build (host)
  result: pass|fail
  notes: <short>

commit:
- sha: <commit_sha_or_none>
- message: <commit_message_or_none>

followups:
- <optional next tasks>
```

If blocked/failed, keep same metadata fields and change prefix accordingly.

---

## 9) Git hygiene

- Commit only task-related changes.
- Commit message format:
  - `autopilot(<app_id>): <task title>`
- If no code changes were required, state that explicitly in comment.

---

## 10) Session traceability

Autopilot should always record a trace tuple:
- `cron_job_id`
- `cron_run_ts`
- `app_id`
- `task_id`
- `agent_session_key` (if available)

This tuple is required for later debugging.

---

## 11) Stop conditions

End the run immediately after:
- exactly one task finished, or
- one blocked/failed report posted.

Do not chain into a second task in the same run.
