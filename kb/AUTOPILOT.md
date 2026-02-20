# Citadel Autopilot

**Goal:** One scheduled run = one task executed safely.

## Scope
**Apps:** `smart-notes`, `gym-tracker`, `soumil-mood-tracker`  
**Meta:** `scrum-board` (board maintenance), `citadel` (host/platform — control plane, not a user app)

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

## API Usage (Required)

**IMPORTANT:** All task operations MUST use the REST API, not direct SQL. This ensures proper lock management and business logic enforcement.

### Available Endpoints

| Operation | Endpoint | Method |
|-----------|----------|--------|
| List tasks | `/api/apps/scrum-board/tasks?app={appId}` | GET |
| Update task | `/api/apps/scrum-board/tasks` | PATCH |
| Add comment | `/api/apps/scrum-board/comments` | POST |
| Check lock | `/api/apps/scrum-board/lock` | GET |

### Helper Library

Use the provided helper functions from `@/lib/autopilotApi`:

```typescript
import {
  fetchTasks,
  fetchEligibleTasks,
  getHighestPriorityTask,
  claimTask,
  updateTask,
  completeTask,
  failTask,
  requestInput,
  blockTask,
  retryTask,
  addComment,
  isAgentLocked,
} from '@/lib/autopilotApi';
```

### Standard Flow Example

```typescript
// 1. Fetch eligible tasks
const tasks = await fetchEligibleTasks('smart-notes');

// 2. Get highest priority task
const task = await getHighestPriorityTask('smart-notes');
if (!task) return; // No work

// 3. Claim task
await claimTask(task.id, session_id);

// 4. Do work...

// 5. Complete with comment
await completeTask(task.id, `[AUTOPILOT_DONE]
app_id: smart-notes
task_id: ${task.id}
cron_job_id: ${cron_job_id}

summary: Implemented feature X
files_changed: src/components/X.tsx
validation: npm run build — passed
`);
```

### Manual API Calls (if helpers unavailable)

```bash
# Fetch tasks
curl -s "http://localhost:3000/api/apps/scrum-board/tasks?app=smart-notes"

# Claim task (set in_progress)
curl -s -X PATCH http://localhost:3000/api/apps/scrum-board/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "status": "in_progress",
    "claimed_by": "autopilot",
    "claimed_at": "2026-02-20T10:00:00Z",
    "session_id": "sess-..."
  }'

# Add comment
curl -s -X POST http://localhost:3000/api/apps/scrum-board/comments \
  -H "Content-Type: application/json" \
  -d '{"taskId": 123, "body": "[AUTOPILOT_DONE] ..."}'

# Mark done (releases lock automatically)
curl -s -X PATCH http://localhost:3000/api/apps/scrum-board/tasks \
  -H "Content-Type: application/json" \
  -d '{"id": 123, "status": "done", "comment": "[AUTOPILOT_DONE] ..."}'
```

## Task Selection
From Scrum Board for target app only:
- Eligible: `status=todo`, `attempt_count < max_attempts`, not claimed
- Rank by: highest `priority` → oldest `created_at` → lowest `id`

**Use API:** `await getHighestPriorityTask(app_id)`

## Claim (before coding)
1. Move task to `in_progress`
2. Set: `claimed_by: autopilot`, `claimed_at: <iso>`, `last_run_at: <iso>`, `session_id: <key>`

**Use API:** `await claimTask(taskId, session_id)`

## Execute
1. Read task + acceptance criteria
2. Implement minimally
3. Validate: `npm run build` in `host/`
4. Mark result

## Completion

**Use API helpers:**
- Success: `await completeTask(taskId, comment)`
- Needs input: `await requestInput(taskId, questions, comment)`
- Blocked: `await blockTask(taskId, reason, comment)`
- Failed (retry): `await retryTask(taskId, attemptCount, error, comment)`
- Failed (final): `await failTask(taskId, error, comment)`

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

## Lock Management

The API automatically handles agent lock release when tasks move to terminal states:
- `done`
- `failed`
- `blocked`
- `needs_input`
- `validating`

**Do NOT** manually release locks or query the `agent_locks` table directly.
Use `await isAgentLocked()` to check lock status if needed.
