# KB: Autopilot

Source: `kb/AUTOPILOT.md`

## Highlights

- Recurring automation targets board app `citadel`
- Picks exactly one eligible task per cycle (`todo`, attempts under limit, unlocked)
- Backlog tasks are intentionally excluded
- Validation includes `npm run build` for host (and affected external apps)
- Restart sequence required after completed task for host + app ports
