# Introduction

Citadel is a **local-first personal app hub**.

It has two main parts:

- **Host control plane** (shell UI, app registry, gateway proxy, permissions)
- **Apps** (built-in or external, any stack)

## Repository layout

- `host/` — Next.js host shell + gateway + registry + permissions
- `apps/` — built-in host apps
- `external-apps/` — standalone extracted/generated apps
- `scripts/` — utilities + `citadel-app` CLI
- `data/` — runtime local data (gitignored)

## Core docs

- [Architecture](https://github.com/rohanchaudhari/citadel/blob/main/ARCHITECTURE.md)
- [Vision](https://github.com/rohanchaudhari/citadel/blob/main/VISION.md)
- [Contributing](https://github.com/rohanchaudhari/citadel/blob/main/CONTRIBUTING.md)
- [Security](https://github.com/rohanchaudhari/citadel/blob/main/SECURITY.md)
