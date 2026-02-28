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

Use Scrum Board external proxy base:
- `SB_BASE=http://localhost:3000/api/gateway/apps/scrum-board-external/proxy/api/scrum-board`

| Operation | Endpoint | Method |
|-----------|----------|--------|
| List tasks | `${SB_BASE}/tasks?app={appId}` | GET |
| Update task | `${SB_BASE}/tasks` | PATCH |
| Add comment | `${SB_BASE}/comments` | POST |
| Check lock | `${SB_BASE}/lock` | GET |

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
SB_BASE="http://localhost:3000/api/gateway/apps/scrum-board-external/proxy/api/scrum-board"
curl -s "$SB_BASE/tasks?app=smart-notes"

# Claim task (set in_progress)
curl -s -X PATCH "$SB_BASE/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "status": "in_progress",
    "claimed_by": "autopilot",
    "claimed_at": "2026-02-20T10:00:00Z",
    "session_id": "sess-..."
  }'

# Add comment
curl -s -X POST "$SB_BASE/comments" \
  -H "Content-Type: application/json" \
  -d '{"taskId": 123, "body": "[AUTOPILOT_DONE] ..."}'

# Mark done (releases lock automatically)
curl -s -X PATCH "$SB_BASE/tasks" \
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
3. Validate (required, end-of-run):
   - `npm run build` in `host/`
   - If external app changed: `npm run build` in that external app folder
   - If UI/route behavior changed and browser automation is available: run Playwright/browser smoke for the changed flow
   - If browser automation is not available: run equivalent API/curl smoke checks and record results in comment
4. If `app_id` is `citadel`, restart host + all external app servers after changes.
5. Mark result

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

## New App Creation Checklist

When a task requires creating a **new app** (not modifying existing):

### 1. Create App Manifest
Create `apps/<app-id>/app.yaml`:
```yaml
id: <app-id>
name: <App Name>
version: 0.1.0
permissions:
  db:
    read: true
    write: true
  storage:
    read: true
    write: true
connectors: []
```

### 2. Generate App Icon (REQUIRED)
**Use nano-banana-pro to create the icon:**

```bash
cd /home/rohanchaudhari/personal/citadel
uv run /home/linuxbrew/.linuxbrew/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "App icon logo design, modern flat style, <describe app purpose>, gradient background, minimal clean design, rounded corners, no text" \
  --filename "<app-id>-logo.png" \
  --resolution 1K
```

**Move to public folder:**
```bash
mv <app-id>-logo.png host/public/app-logos/
```

**Icon requirements:**
- Resolution: 1K (1024x1024) minimum
- Style: Modern flat design with gradient
- Format: PNG
- Location: `host/public/app-logos/<app-id>-logo.png`

### 3. Implement App
- Create `host/src/app/apps/<app-id>/page.tsx`
- Create `host/src/app/api/apps/<app-id>/` routes as needed
- Build and test: `npm run build` in `host/`

### 4. Verification
After build passes, the app will automatically appear on the home page at `/`.

**Home page shows:**
- App icon from `/app-logos/<app-id>-logo.png`
- App name from `app.yaml`
- Link to `/apps/<app-id>`

### Common Mistakes to Avoid
- ❌ Forgetting to create `app.yaml` → app won't register
- ❌ Forgetting to generate icon → blank/missing icon on home
- ❌ Wrong icon path → 404 error on home page
- ❌ Not running build → app not visible until restart
