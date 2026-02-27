# Scrum Board (External Next.js)

Standalone extraction of Scrum Board while keeping OpenClaw autopilot behavior intact.

## Run

```bash
cd external-apps/scrum-board-next
npm install
./scripts/copy-db.sh
npm run build
npm run start
```

## Register

```bash
./scripts/register-external-scrum.sh
```

Open:
- http://localhost:3000/apps/scrum-board-external
