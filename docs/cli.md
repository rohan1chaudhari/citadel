# CLI: `citadel-app`

Run through npm at repo root:

```bash
npm run citadel-app -- <command> [options]
```

## Commands

### `create`
Create a new external app scaffold.

```bash
npm run citadel-app -- create <name> [--out <dir>] [--port <n>]
```

Example:

```bash
npm run citadel-app -- create "Demo Notes" --port 4022
```

### `dev`
Install dependencies if needed, then run the app in dev mode.

```bash
npm run citadel-app -- dev <app-dir>
```

### `install`
Install/register an app into Citadel host.

```bash
npm run citadel-app -- install <app-dir> \
  [--url <http://localhost:PORT>] \
  [--host <http://localhost:3000>] \
  [--icon <path>] \
  [--docker-build] \
  [--docker-image <name>]
```

Notes:

- If `--url` is not provided, Citadel tries to infer from `runtime.port` in `citadel.app.json`.
- If `--docker-build` is used, a Docker image is built before registration.
- If the manifest has a `runtime` block, `runtime apply` is triggered automatically after install.

### `runtime`
Manage app runtime lifecycle through the host API.

```bash
npm run citadel-app -- runtime <status|apply|start|stop|restart|enable|disable> <app-id>
```

Examples:

```bash
npm run citadel-app -- runtime status my-app
npm run citadel-app -- runtime apply my-app
npm run citadel-app -- runtime restart my-app
```
