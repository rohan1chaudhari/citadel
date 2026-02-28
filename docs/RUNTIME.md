# Citadel App Runtime Manager

The Runtime Manager allows Citadel to dynamically manage app lifecycles using systemd user services. Apps declare their runtime requirements in `citadel.app.json`, and Citadel generates systemd units to handle build, start, stop, and restart operations.

## One-Time Setup

### 1. Enable user systemd services

Ensure your user systemd instance is running:

```bash
loginctl enable-linger $USER
systemctl --user status
```

If not running, start it:
```bash
export XDG_RUNTIME_DIR=/run/user/$(id - u)
systemctl --user daemon-reload
```

### 2. Verify systemd user directory exists

```bash
mkdir -p ~/.config/systemd/user
```

## App Manifest Runtime Block

Add a `runtime` block to your `citadel.app.json`:

```json
{
  "id": "my-app",
  "name": "My App",
  "version": "1.0.0",
  "entry": "/",
  "health": "/healthz",
  "permissions": [],
  "runtime": {
    "cwd": "./",
    "build": "npm run build",
    "start": "npm start",
    "port": 4020,
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

### Runtime Fields

| Field | Required | Description |
|-------|----------|-------------|
| `cwd` | Yes | Working directory relative to repo root |
| `build` | Yes | Command to build the app before starting |
| `start` | Yes | Command to start the app |
| `port` | Yes | Port the app listens on |
| `env` | No | Environment variables as key-value pairs |

## App Lifecycle

### Install with Runtime

When you install an app with a runtime block, the runtime is automatically applied:

```bash
node scripts/citadel-app.mjs install ./external-apps/my-app --url http://localhost:4020
```

### Manual Runtime Management

Use the CLI to manage app runtime:

```bash
# Check status
node scripts/citadel-app.mjs runtime status my-app

# Apply runtime (generate systemd unit)
node scripts/citadel-app.mjs runtime apply my-app

# Start/Stop/Restart
node scripts/citadel-app.mjs runtime start my-app
node scripts/citadel-app.mjs runtime stop my-app
node scripts/citadel-app.mjs runtime restart my-app

# Enable/Disable auto-start on boot
node scripts/citadel-app.mjs runtime enable my-app
node scripts/citadel-app.mjs runtime disable my-app
```

### API Endpoints

Runtime management is also available via API:

```bash
# Get runtime status
curl http://localhost:3000/api/apps/my-app/runtime

# Apply runtime
curl -X POST http://localhost:3000/api/apps/my-app/runtime \
  -H "Content-Type: application/json" \
  -d '{"action":"apply"}'

# Start/stop/restart
curl -X POST http://localhost:3000/api/apps/my-app/runtime \
  -H "Content-Type: application/json" \
  -d '{"action":"start"}'
```

## How It Works

1. **Manifest Registration**: When an app is registered with a `runtime` block, the configuration is stored in the Citadel database.

2. **Unit Generation**: The `apply` action generates a systemd user service unit at `~/.config/systemd/user/citadel-app-<appId>.service`.

3. **Lifecycle Management**: Standard systemd commands control the app:
   - `systemctl --user start citadel-app-my-app`
   - `systemctl --user stop citadel-app-my-app`
   - `systemctl --user status citadel-app-my-app`

4. **Build Integration**: Each unit has an `ExecStartPre` that runs the build command before starting.

5. **Health Check**: Citadel continues to use the declared `health` endpoint for health monitoring.

## No Hardcoded Apps

The runtime manager works for any registered app with a runtime configuration. There are no hardcoded app IDs or special cases. Simply register any app with a runtime block and use the same commands.

## Troubleshooting

### Unit not found
Ensure systemd user directory exists and daemon is reloaded:
```bash
mkdir -p ~/.config/systemd/user
systemctl --user daemon-reload
```

### Permission denied
Ensure the app directory and files are readable by your user.

### Port already in use
Check if another process is using the app's port:
```bash
lsof -i :4020
```

### View unit logs
```bash
journalctl --user -u citadel-app-my-app -f
```
