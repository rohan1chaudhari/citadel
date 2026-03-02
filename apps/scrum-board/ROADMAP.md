# Scrum Board — App Roadmap

> Platform roadmap: [`kb/ROADMAP.md`](../../kb/ROADMAP.md)

---

## v0.1 — Foundation ✅ COMPLETE

Core board UI and autopilot orchestration.

- [x] Task CRUD with title, description, priority, acceptance criteria
- [x] Kanban columns: backlog → todo → in_progress → review → done
- [x] Drag-and-drop between columns
- [x] Autopilot orchestration — picks todo tasks, launches agent sessions, moves through workflow
- [x] Session tracking — per-task session with status, start/end time, log path
- [x] Stuck-task watcher — detects stale in_progress tasks, releases locks
- [x] Vision suggestion — AI generates next tasks from app vision doc
- [x] Inbox for suggested tasks — review, accept, or dismiss AI proposals
- [x] Human-in-the-loop review — pause at review stage for human approval
- [x] Input requests — agent can ask for human input mid-session
- [x] Comment thread on tasks (human + system)
- [x] Priority levels with visual indicators
- [x] App selector and per-app board views

## v0.2 — Observability & Polish

Make the autopilot loop trustworthy and the daily board experience smoother.

### Observability
- [ ] Session history view — browsable list of past sessions with status, duration, task link
- [ ] Session summary — structured summary after each run (what changed, files touched, result)
- [ ] Autopilot dashboard — stats: tasks completed, success rate, avg duration, queue depth
- [ ] Failure diagnostics — parse session logs for errors, surface on task card

### Board UX
- [ ] Due date indicators — overdue highlighting, sort overdue to top
- [ ] Input deadline enforcement — countdown on waiting tasks, auto-expire past deadline
- [ ] Bulk actions — multi-select for status change, delete, priority update
- [ ] Done column cleanup — auto-archive old done tasks, collapsible column
- [ ] Board keyboard shortcuts — n (create), j/k (navigate), enter (open), esc (close)

### Code Quality
- [ ] Split ScrumBoardClient — break monolith into BoardColumn, TaskCard, TaskModal, etc.
- [ ] Optimistic UI updates — patch local state immediately, revert on error

## v0.3 — Smarter Autopilot

Make the agent work through tasks more intelligently.

### Task Graph
- [ ] Task dependencies — `blocked_by` support; blocked tasks can't be picked by autopilot
- [ ] Task chaining — completing a task auto-queues newly unblocked tasks
- [ ] Subtask decomposition — split tasks into subtasks, parent resolves when children done

### Agent Intelligence
- [ ] Multi-round validation — reject sends back to in_progress with feedback, agent iterates
- [ ] Acceptance criteria checks — agent parses criteria into assertions, reports pass/fail
- [ ] Auto-plan generation — generate plan doc when task moves to todo (if none exists)
- [ ] Agent memory — persist context summary between sessions for same app

### Configuration
- [ ] Configurable autopilot strategy — max tasks per cycle, selection policy, retry policy
- [ ] Token usage tracking — log tokens per session, show cumulative cost

## v0.4 — Open-Source & Collaboration Ready

Prepare for public use.

### Onboarding
- [ ] Comprehensive README with screenshots and config guide
- [ ] First-launch setup — guide user through API key + agent runner config

### UI
- [ ] Theming — respect host dark/light theme, no hardcoded colors
- [ ] Board filters and search — filter by assignee, priority, date; full-text search
- [ ] Activity timeline — chronological view of all state changes per task
- [ ] Comment attribution — human vs autopilot vs system with distinct styling

### Data
- [ ] Task templates — save reusable task structures (bug fix, new feature, refactor)
- [ ] Export/import — board as JSON/CSV

### Resilience & Integration
- [ ] Offline resilience — board works without AI when no API key configured
- [ ] Notification hooks — emit events on state changes (webhook-ready)
