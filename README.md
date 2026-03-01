<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/citadel-logo-dark.svg">
    <img src="docs/public/images/citadel-logo.svg" alt="Citadel" width="120">
  </picture>
</p>

<h1 align="center">Citadel</h1>

<p align="center">
  <strong>Local-first personal app hub.</strong><br>
  One host, isolated apps, your data stays on your machine.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
</p>

<p align="center">
  <a href="docs/what-is-citadel.md">What is Citadel?</a> ·
  <a href="docs/intro.md">Docs</a> ·
  <a href="docs/how-to/quickstart.md">Quickstart</a> ·
  <a href="docs/how-to/build-an-app.md">Build an App</a> ·
  <a href="docs/app-spec.md">App Spec</a> ·
  <a href="kb/ROADMAP.md">Roadmap</a>
</p>

---

## Quick start

Runtime: **Node >= 22**.

```bash
cd host && npm install && npm run dev
# → http://localhost:3000
```

## Create an app

```bash
node scripts/citadel-app.mjs create my-app --template=crud
```

Templates: `blank` · `crud` · `ai` · `dashboard` — [CLI docs](docs/cli.md)

## How it works

```
Browser → Middleware (CSP, rate limit) → App routes → @citadel/core → SQLite (per app)
```

Each app gets its own database and storage. Apps declare permissions in `app.yaml` — the host enforces them. No cross-app access. Everything is audited.

```
host/       → Next.js control plane
core/       → @citadel/core (db, storage, audit, permissions)
apps/       → App packages (manifest + migrations)
templates/  → Starter templates
scripts/    → citadel-app CLI
```

## Built-in apps

Smart Notes · Gym Tracker · Scrum Board · French Translator · Friend Tracker · Promo Kit · Mood Tracker

## License

[MIT](LICENSE) — Rohan Chaudhari
