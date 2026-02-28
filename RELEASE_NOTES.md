# Release Notes

## v0.1.0 (Initial Release) — February 28, 2026

Citadel is a local-first personal app hub with a host control plane and pluggable standalone apps.

### What's Included

**Host Platform**
- Next.js-based host shell with app registry, gateway proxy, and permissions broker
- App manifest system (`citadel.app.json`) for declarative app registration
- Gateway routing with reverse proxy to external apps
- Permission system for camera, microphone, notifications, filesystem, and agent execution
- Scrum Master app for AI-assisted task management with autopilot integration

**External Apps (4 bundled)**
- **French Translator** — Real-time French audio transcription and translation
- **Gym Tracker** — Voice-powered workout logging and exercise tracking
- **Smart Notes** — Photo + voice note-taking with AI categorization
- **Scrum Board** — Kanban-style task management with autopilot automation

**Developer Experience**
- `citadel-app` CLI for scaffolding, dev, and installing apps
- Docker Compose setup for containerized external apps
- Hot-reload development workflow

### Quick Start
```bash
cd host && npm install && npm run dev
# Open http://localhost:3000
```

### Known Limitations
- Requires Node.js 20+ and local SQLite
- External apps must be run separately (or via Docker Compose)
- No built-in authentication/authorization (single-user local mode)
- Mobile web UI functional but not optimized
- Autopilot requires external OpenClaw or compatible agent runtime

### System Requirements
- Node.js 20+
- npm or yarn
- SQLite3 (bundled)
- Docker (optional, for containerized apps)

---

## Changelog

### v0.1.0
- Initial open-source release
- Containerized app contract v0 with manifest validation
- Gateway proxy routing for external apps
- Permission broker with grant/revoke UI
- AgentRuntime abstraction for pluggable AI backends
- Legacy route redirects for migrated internal apps
- App ID cleanup (removed *-external suffixes)
