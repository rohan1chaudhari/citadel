# Citadel

**Local-first personal app hub.** One host, isolated apps, your data stays on your machine.

[What is Citadel?](docs/what-is-citadel.md) · [Docs](docs/intro.md) · [Quickstart](docs/how-to/quickstart.md) · [Build an App](docs/how-to/build-an-app.md) · [App Spec](docs/app-spec.md) · [Roadmap](kb/ROADMAP.md)

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

Templates: `blank`, `crud`, `ai`, `dashboard`. Full CLI docs: [`docs/cli.md`](docs/cli.md).

## How it works

Each app gets its own SQLite database and storage directory. Apps declare permissions in `app.yaml` — the host prompts for consent on first launch. No cross-app data access. Audit everything.

```
host/       → Next.js control plane (routing, permissions, audit)
apps/       → App packages (manifest + migrations)
core/       → @citadel/core (db, storage, audit, permissions)
templates/  → Starter templates
scripts/    → citadel-app CLI
```

## Built-in apps

Smart Notes · Gym Tracker · Scrum Board · French Translator · Friend Tracker · Promo Kit · Mood Tracker

## License

[MIT](LICENSE)
