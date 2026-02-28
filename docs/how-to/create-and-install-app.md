# How-to: Create and install an external app

## Create

```bash
npm run citadel-app -- create "Demo Notes" --port 4022
```

This generates:

- `package.json`
- `citadel.app.json`
- `server.mjs`
- `Dockerfile`
- `README.md`

under `external-apps/demo-notes`.

## Run locally

```bash
cd external-apps/demo-notes
npm install
npm start
```

## Install into host

```bash
cd /home/rohanchaudhari/personal/citadel
npm run citadel-app -- install external-apps/demo-notes --url http://localhost:4022
```

## Optional: add icon

```bash
npm run citadel-app -- install external-apps/demo-notes \
  --url http://localhost:4022 \
  --icon ./path/to/logo.png
```
