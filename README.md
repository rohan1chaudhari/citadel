# Citadel

Local-first personal app hub with a host shell and pluggable standalone apps.

## What it is
- **Host control plane**: app registry, proxy routing, permissions, shell UI
- **Apps**: built-in or external (any stack)
- **Local-first**: data stays on your machine/network

## Quickstart

### 1) Run host
```bash
cd host
npm install
npm run dev
```
Open: `http://localhost:3000`

### 2) Create your first external app
```bash
cd ..
npm run citadel-app -- create "My App" --port 4020
cd external-apps/my-app
npm install
npm start
```

### 3) Install app into Citadel
```bash
cd /home/rohanchaudhari/personal/citadel
npm run citadel-app -- install external-apps/my-app --url http://localhost:4020
```
Open: `http://localhost:3000/apps/my-app`

## Repo layout
- `host/` — Next.js host shell + gateway + registry + permissions
- `apps/` — built-in host apps
- `external-apps/` — standalone extracted/generated apps
- `scripts/` — utilities + `citadel-app` CLI
- `data/` — runtime local data (gitignored)

## 90-second demo flow
```bash
# terminal 1: run host
cd host && npm run dev

# terminal 2: scaffold + run an external app
cd ..
npm run citadel-app -- create "Demo Notes" --port 4022
cd external-apps/demo-notes && npm install && npm start

# terminal 3: register into Citadel
cd /home/rohanchaudhari/personal/citadel
npm run citadel-app -- install external-apps/demo-notes --url http://localhost:4022
```
Then open:
- `http://localhost:3000/apps/demo-notes`

## Architecture snapshot
```text
Browser
  -> Citadel Host (3000)
      - shell UI
      - app registry (/api/apps)
      - gateway proxy (/api/gateway/apps/:id/proxy/*)
      - permission broker
  -> External App (e.g. 4022)
      - standalone UI/API
      - app-owned DB/storage
```

## Key docs
- `VISION.md` — product philosophy and direction
- `ARCHITECTURE.md` — system design overview
- `EXTRACTION_PLAYBOOK.md` — how to extract apps safely (DB included)
- `CONTRIBUTING.md` — contribution workflow
- `SECURITY.md` — trust model + reporting
- `SUPPORT.md` — troubleshooting and support flow
- `plan.md` — migration roadmap

## Security/permissions
- External apps declare permissions in `citadel.app.json`
- Host enforces effective permissions via gateway/runtime checks

## License
MIT
