# How-to: Manage app runtime

Citadel can manage app lifecycle with user-level systemd services.

## One-time setup

```bash
loginctl enable-linger $USER
systemctl --user status
mkdir -p ~/.config/systemd/user
```

## Manifest runtime block

Add this in `citadel.app.json`:

```json
{
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

## Runtime commands

```bash
npm run citadel-app -- runtime status my-app
npm run citadel-app -- runtime apply my-app
npm run citadel-app -- runtime start my-app
npm run citadel-app -- runtime stop my-app
npm run citadel-app -- runtime restart my-app
npm run citadel-app -- runtime enable my-app
npm run citadel-app -- runtime disable my-app
```

For deeper details, see [RUNTIME.md](https://github.com/rohanchaudhari/citadel/blob/main/docs/RUNTIME.md).
