# Introduction

Citadel is a **local-first personal app hub**.

It has two main parts:

- **Host control plane** (`host/`) — Next.js shell, app registry, permissions, audit, routing
- **Apps** (`apps/`) — standalone packages (manifest + migrations), UI and API routes served by host

## Repository layout

```
host/        — Next.js host shell + API gateway + permissions + audit
apps/        — App packages (app.yaml + migrations/)
core/        — @citadel/core shared library
templates/   — App starter templates (blank, crud, ai, dashboard)
scripts/     — citadel-app CLI (create, install, update, dev, migrate)
docs/        — This documentation site (VitePress)
kb/          — Project knowledge base + roadmap
data/        — Runtime data (gitignored)
```

## Platform features

- **Permissions** — apps declare scopes in `app.yaml`; user approves on first launch
- **Isolation** — per-app SQLite DB and storage root; SQL guardrails; path traversal blocked
- **Audit** — all DB/storage/API events logged to `audit_log` table; viewer at `/audit`
- **Backup** — scheduled local backups + per-app export/import (zip)
- **PWA** — installable on iOS/Android; offline shell; responsive + dark mode
- **CLI** — `citadel-app create/install/update/dev/migrate` for app lifecycle
- **Autopilot** — AI agent that picks up scrum-board tasks and implements them autonomously

## Quick start

See [Quickstart](/how-to/quickstart) to run the host and install your first app.

## Build an app

See [Build an App](/how-to/build-an-app) for a step-by-step tutorial building a CRUD app from scratch.

## App spec

See [App Spec](/app-spec) for the full app package format reference.
