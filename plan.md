# Citadel Plan: Move from Next.js submodules to containerized app platform

## Goal
Decouple Citadel apps from the monorepo/submodule model and move to independently deployable containerized apps (any stack), unified by a thin Citadel Gateway + Web Shell.

## Target Architecture

### 1) Citadel Gateway (thin control plane)
Responsibilities:
- App registry + discovery
- Reverse proxy / routing (`/apps/:slug/*`)
- Session/security mode (network-trust mode now, optional auth later)
- Permission/capability broker
- Agent runtime broker (OpenClaw, Codex, Claude Code, etc.)
- Health/status aggregation

Non-goals:
- App business logic
- App-specific data models

### 2) Citadel Shell (UI)
Responsibilities:
- Global nav, app launcher, settings
- Notifications inbox
- Permission prompts/audit
- Global search (later)

### 3) Apps (data plane)
Each app runs as its own container/service and can be built in any framework.

---

## Minimum App Contract (v0)

### A) App manifest (`citadel.app.json`)
```json
{
  "id": "scrum",
  "name": "Scrum Board",
  "version": "0.1.0",
  "entry": "/",
  "health": "/healthz",
  "events": "/events",
  "permissions": ["agent:run", "notifications"],
  "agent": {
    "required": true,
    "capabilities": ["run", "stream"]
  },
  "ui": {
    "icon": "kanban",
    "category": "productivity"
  }
}
```

### B) Required endpoints
- `GET /healthz` → `{ "ok": true, "version": "..." }`
- `GET /meta` (optional but recommended) → manifest-ish runtime metadata
- Main app HTTP entrypoint at `/`

### C) Optional endpoints
- `POST /events` for gateway->app event delivery
- `POST /agent/callback` for async agent completion

### D) Event shape (gateway->app)
```json
{
  "type": "notification.created",
  "timestamp": "2026-02-27T10:00:00Z",
  "payload": { "title": "Build finished" }
}
```

### E) Permission model (initial)
Manifest-declared permissions, gateway-enforced:
- `notifications`
- `camera`
- `microphone`
- `gallery`
- `filesystem`
- `agent:run`

---

## Gateway Routes (v0)
- `GET /api/apps` → list installed apps + health + permissions
- `POST /api/apps/install` → register app manifest + target URL/container ref
- `POST /api/apps/:id/start|stop|restart`
- `POST /api/apps/:id/permissions/grant|revoke`
- `POST /api/agent/run` → runtime-agnostic dispatch
- `GET /api/system/health`

Proxy rule:
- `/apps/:id/*` -> target app upstream

---

## Agent Runtime Interface (v0)
Keep this stable and adapter-based.

```ts
interface AgentRuntime {
  id(): string; // openclaw | codex | claude-code | opencode
  health(): Promise<{ ok: boolean; details?: string }>;
  run(input: {
    task: string;
    context?: Record<string, unknown>;
    stream?: boolean;
  }): Promise<{ runId: string; status: "queued" | "running" | "done" | "failed"; output?: string }>;
  cancel(runId: string): Promise<{ ok: boolean }>;
}
```

---

## Container Model

### Option A (simple now)
- Docker Compose with static app services
- Gateway reads manifests from mounted `apps.d/` dir

### Option B (later)
- Dynamic app lifecycle via container API
- Pull/install packaged app bundles

Start with **Option A**.

---

## Migration Plan

### Phase 1 (1 week)
- Implement gateway app registry + `/api/apps`
- Add reverse proxy route `/apps/:id/*`
- Define manifest schema + validation

### Phase 2 (1 week)
- Extract one existing Next.js app into standalone container
- Register it via manifest
- Run through gateway proxy

### Phase 3 (1 week)
- Implement `AgentRuntime` interface + OpenClaw adapter
- Migrate Scrum app to use runtime interface (no direct OpenClaw coupling)

### Phase 4 (1 week)
- Add permissions broker and app-level permission settings
- Add notification event path

### Phase 5 (3-4 days)
- Docs + examples: “build your first Citadel app”
- OSS readiness: CONTRIBUTING, API contract docs, template app

---

## Definition of Done (v0)
- A non-Next app can be added and launched in Citadel
- Gateway proxies multiple independent app containers
- Scrum app can run via runtime adapter (OpenClaw first)
- Permissions are declared by manifest and enforced by gateway
- New app can be scaffolded from template and registered in <10 minutes
