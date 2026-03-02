# Citadel Vision

## Why Citadel exists

Personal software should feel like **your space**, not rented shelf space.

Citadel exists to make that practical:
- Run your personal apps locally
- Own your data
- Compose workflows from modular apps
- Add AI where useful, not everywhere by force

Citadel is the platform layer for a personal app ecosystem.

---

## What Citadel is

Citadel is a **local-first app hub** with:
- a host shell (navigation, registry, permissions, routing)
- independent app runtimes (external apps, any stack)
- optional agent automation for workflows like planning/execution

The core product is not one app — it’s the substrate that lets many apps coexist cleanly.

---

## What Citadel is not

- Not a monolithic super-app where everything is tightly coupled
- Not a cloud-first SaaS that holds your personal context hostage
- Not an “AI wrapper” that requires one vendor/runtime forever
- Not a multi-tenant enterprise platform (at least not the current trust model)

---

## Principles

### 1) Local-first by default
Data and execution should work on your own machine/network first.
Cloud integrations are optional extensions, not baseline dependencies.

### 2) Platform over product bundle
Citadel should be better at hosting apps than at forcing one “official” stack.
Apps are extensions; host is infrastructure.

### 3) Stable contracts, flexible implementations
The app contract (manifest, health, permissions, routing) must be stable.
Inside that contract, apps can use any framework/runtime.

### 4) Clean boundaries
Host handles shell/policy/routing.
Apps handle domain logic/data.
Agent runtimes handle automation.
No hidden coupling.

### 5) User-owned trust boundary
Citadel assumes a personal/single-owner deployment model.
Safety means clear permissions and explicit control, not opaque magic.

### 6) Progressive sophistication
Start simple (working local setup).
Add complexity only when proven necessary (mobile bridge, runtime adapters, ecosystem tooling).

---

## Product direction

### Near-term (Phase 3 — open source ready)
- Extract apps into standalone repos (apps are not part of the platform)
- Docker + deployment story for self-hosters
- Harden reliability (graceful startup/shutdown, DB health checks)
- Ship release-ready docs, CI, and first tagged release

### Mid-term (Phase 4 — app ecosystem)
- GitHub-based app registry (search, install, publish)
- Cross-app workflows (trigger → condition → action chains)
- Container-based isolation for untrusted community apps
- Push notifications via service worker
- Home screen widgets for at-a-glance app data

### Long-term
- Healthy extension ecosystem (first-party + community apps)
- App portability between self-hosted environments
- Runtime abstraction: apps in any stack behind a stable contract (not just Next.js)
- Opinionated but optional deployment modes (single machine, homelab, lightweight VPS)

---

## North star

A person should be able to:
1. Clone Citadel
2. Start it in minutes
3. Install or build apps that feel native to their own workflow
4. Keep full ownership of their data and operating model

If Citadel can do that reliably, it succeeds.
