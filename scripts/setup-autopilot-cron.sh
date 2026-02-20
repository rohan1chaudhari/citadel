#!/bin/bash
# Setup script for 15-minute autopilot cron job
# This creates a recurring cron job that runs every 15 minutes

set -e

# The cron message - targets scrum-board only
MESSAGE='Autopilot cycle for Citadel app: scrum-board (scrum-board)

Context:
- Repo: /home/rohanchaudhari/personal/citadel
- Runbook: /home/rohanchaudhari/personal/citadel/kb/AUTOPILOT.md
- Target app_id: scrum-board
- Triggered by: scrum-board UI
- cron_job_id: RECURRING-15MIN
- cron_run_ts: AUTO

Execution contract:
1) Read AUTOPILOT.md and follow it strictly.
2) Read scrum-board tasks for this app only.
3) Pick highest-priority eligible task in status "todo" with attempt_count < max_attempts.
4) Claim task (set status "in_progress", set claimed_by/claimed_at/last_run_at/session_id).
5) Implement exactly one task.
6) Validate with "npm run build" in /home/rohanchaudhari/personal/citadel/host.
7) Update task:
   - done if complete + validated
   - needs_input if human decision required
   - blocked if external dependency
   - failed if retries exhausted; else increment attempt_count and return to todo
8) Add structured comment with debug metadata and stop.'

echo "Creating recurring 15-minute autopilot cron job..."

# Add the cron job using openclaw
# Using --every with 15 minutes (900000 ms)
# NO --delete-after-run so sessions persist for debugging
openclaw cron add \
  --name "autopilot-scrum-board-15min" \
  --session isolated \
  --every "15m" \
  --message "$MESSAGE" \
  --thinking low \
  --timeout-seconds 600 \
  --json

echo "Cron job created successfully!"
echo "The autopilot will run every 15 minutes for scrum-board."
echo "Note: This job respects the autopilot toggle switch in the UI."
