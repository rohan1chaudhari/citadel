# Quickstart

## 1) Run host

```bash
cd host
npm install
npm run dev
```

Open: `http://localhost:3000`

## 2) Create and run your first external app

```bash
cd ..
npm run citadel-app -- create "My App" --port 4020
cd external-apps/my-app
npm install
npm start
```

## 3) Install app into Citadel

```bash
cd /home/rohanchaudhari/personal/citadel
npm run citadel-app -- install external-apps/my-app --url http://localhost:4020
```

Open: `http://localhost:3000/apps/my-app`

## 4) Install official apps (extraction-ready flow)

As apps move to standalone repos, install them via CLI:

```bash
node scripts/citadel-app.mjs install <repo-url>
```

See target app repos + install commands in `apps/README.md`.

## Data safety note (important)

Before extracting/uninstalling any app, export and verify backups for that app first. Never delete `data/apps/<appId>/` without a verified backup.
