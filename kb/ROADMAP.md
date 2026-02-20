# Citadel Roadmap

## Overview
This roadmap covers three key areas:
- **Smart Notes** — flagship MVP app
- **Scrum Board** — project management with agent integration
- **Citadel Host** — the control plane and runtime

---

## 1. Smart Notes

### Current State (MVP)
- ✅ CRUD notes (create, read, update, delete)
- ✅ Full-text search (title, body, tags)
- ✅ Trash with restore/purge
- ✅ Pinning
- ✅ Tags
- ✅ Voice input
- ✅ Local-first SQLite storage

### v1.0 — Polish & Power User Features
| Feature | Description |
|---------|-------------|
| Backlinks | `[[Note Title]]` auto-links to other notes |
| Daily notes | Auto-create `YYYY-MM-DD` note on open |
| Markdown toolbar | Bold, italic, lists, links without memorizing syntax |
| Export | Markdown, JSON, or HTML export |
| Import | Bulk import from files or JSON |
| Keyboard shortcuts | `Cmd+K` search, `Cmd+N` new note, `Cmd+Shift+T` trash |

### v1.1 — Organization
| Feature | Description |
|---------|-------------|
| Folders / notebooks | Group notes into collections |
| Saved searches | Bookmark common queries |
| Templates | Reusable note templates |
| Note aliases | Multiple titles pointing to same note |

### v1.2 — Collaboration (Future)
| Feature | Description |
|---------|-------------|
| Share links | Read-only or editable share URLs |
| Comments | Inline comments on notes |
| Version history | Diff view of note changes |

---

## 2. Scrum Board

### Current State (Ready)
- ✅ Kanban board with 7 statuses: `backlog`, `todo`, `in_progress`, `needs_input`, `blocked`, `done`, `failed`
- ✅ Task CRUD (title, description, status, priority, assignee, due date)
- ✅ Comments on tasks
- ✅ Multi-board support (app-scoped boards)
- ✅ External project boards (linked repos/live sites)
- ✅ Agent triggering with session linking
- ✅ Live polling during agent runs
- ✅ Task reordering (move up/down)
- ✅ Mobile-responsive UI

### v1.0 — Workflow Hardening
| Feature | Description |
|---------|-------------|
| Automations | Rules like "move to done when PR merged" |
| Sprint boundaries | Start/end dates, velocity tracking |
| Burndown chart | Visual sprint progress |
| Task templates | Quick-create common task types |
| Bulk actions | Multi-select + move/status change |
| WIP limits | Configurable limits per column |

### v1.1 — Agent Integration Deepening
| Feature | Description |
|---------|-------------|
| Task auto-claim | Agent picks up `todo` tasks automatically |
| Smart retry | Exponential backoff for failed tasks |
| Task splitting | Agent can break large tasks into subtasks |
| Context passing | Previous task output → next task input |
| Agent handoff | One agent passes task to another specialty |

### v1.2 — Analytics & Insights
| Feature | Description |
|---------|-------------|
| Cycle time | Time from `todo` to `done` per task |
| Throughput | Tasks completed per week |
| Agent performance | Success rate, average runtime per agent |
| Bottleneck detection | Highlight blocked/aging tasks |

---

## 3. Citadel Host (Control Plane)

### Current State (MVP)
- ✅ Next.js host serves all apps
- ✅ Per-app SQLite isolation
- ✅ Basic permission manifest (`app.yaml`)
- ✅ Audit logging to stdout
- ✅ App routing (`/apps/:appId/*`)
- ✅ API routing (`/api/apps/:appId/*`)
- ✅ Same-process runtime

### v1.0 — Isolation & Security
| Feature | Description |
|---------|-------------|
| SQL guardrails | Query allowlist, stricter injection prevention |
| Storage sandbox | Per-app file isolation enforced |
| Permission enforcement | Host rejects unpermitted ops at runtime |
| App signing | Optional manifest signing for integrity |
| Secrets management | Host-provided secrets (not hardcoded) |

### v1.1 — Orchestration
| Feature | Description |
|---------|-------------|
| Lifecycle hooks | `pre-start`, `post-stop` scripts |
| Health checks | Automated app health monitoring |
| Auto-restart | Restart unhealthy apps |
| Rolling deploys | Zero-downtime app updates |
| Dependency injection | Apps declare deps, host wires them |

### v1.2 — Multi-Runtime (Future)
| Feature | Description |
|---------|-------------|
| Worker processes | CPU-heavy apps run in separate workers |
| Container runtime | Optional Docker isolation |
| Resource limits | CPU/memory caps per app |
| Network egress | Controlled outbound with allowlist |

### v1.3 — Developer Experience
| Feature | Description |
|---------|-------------|
| App scaffolding | CLI to generate new app boilerplate |
| Hot reload | Fast dev iteration per-app |
| App marketplace | Browse/install community apps |
| Migration system | Schema versioning per-app |

---

## Priority Matrix

### Now (Next 2 Weeks)
1. Smart Notes: Backlinks + daily notes
2. Host: SQL guardrails + permission enforcement
3. Scrum Board: Automations + sprint boundaries

### Soon (Next Month)
1. Smart Notes: Markdown toolbar + export
2. Host: Secrets management + lifecycle hooks
3. Scrum Board: Agent auto-claim + retry logic

### Later (Next Quarter)
1. Host: Worker processes + resource limits
2. Scrum Board: Analytics dashboard
3. Smart Notes: Collaboration features

---

## Open Questions

- Should Smart Notes merge with Scrum Board's "daily notes" concept?
- Do we want real-time sync (WebSockets) or is polling sufficient?
- What's the migration path when we move to multi-runtime?
