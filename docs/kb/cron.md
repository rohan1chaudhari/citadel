# KB: Cron

Source: `kb/CRON.md`

## Highlights

- Job name: `autopilot-citadel-recurring`
- Schedule: every 15 minutes
- If no eligible task exists, run idles with `NO_ELIGIBLE_TASKS`
- Includes manual unstick playbook for stale lock/session states
