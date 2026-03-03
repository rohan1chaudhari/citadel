# Citadel Registry

The official app registry for [Citadel](https://github.com/rohan1chaudhari/citadel) — a local-first, self-hosted app platform.

## Browse Apps

See `registry.json` for the full list of available apps.

## Submit Your App

Want to add your app to the registry? Follow these steps:

### 1. Build Your App

Create a Citadel app with the required structure:

```
my-app/
├── app.yaml              # App manifest (required)
├── migrations/           # Database migrations
│   └── 001_initial.sql
├── page.tsx              # Main app page (Next.js component)
├── api/                  # API routes
│   └── route.ts
└── README.md             # App documentation
```

Your `app.yaml` must include:

```yaml
id: my-app
name: My App
version: 1.0.0
permissions:
  db:
    read: true
    write: true
  storage:
    read: true
    write: false
```

### 2. Publish to GitHub

Push your app to a public GitHub repository. The repo must be accessible without authentication.

### 3. Open a Pull Request

1. Fork this repository
2. Add your app entry to `registry.json`:

```json
{
  "id": "my-app",
  "name": "My App",
  "description": "A short description of what your app does (max 150 chars).",
  "repo_url": "https://github.com/YOUR_USERNAME/citadel-my-app",
  "author": "YOUR_USERNAME",
  "tags": ["productivity", "tools"],
  "version": "1.0.0",
  "manifest_version": "1.0"
}
```

3. Submit a pull request with a clear description of your app

### Listing Criteria

Apps in the registry must meet these standards:

- ✅ Publicly accessible GitHub repo
- ✅ Valid `app.yaml` manifest
- ✅ Unique app ID (not already in registry)
- ✅ Clear name and description
- ✅ Working migrations (no destructive SQL)
- ✅ README with installation and usage instructions

### Validation

Our CI automatically checks:

- `repo_url` is reachable
- `app.yaml` exists and is valid YAML
- Required fields are present
- App ID is unique in the registry

## Registry Format

```json
{
  "version": "1.0.0",
  "updated_at": "2026-03-03T00:00:00Z",
  "apps": [
    {
      "id": "app-id",
      "name": "App Name",
      "description": "App description",
      "repo_url": "https://github.com/user/repo",
      "author": "username",
      "tags": ["tag1", "tag2"],
      "version": "1.0.0",
      "manifest_version": "1.0",
      "homepage": "/apps/app-id",
      "icon": "/app-logos/app-id-logo.png"
    }
  ]
}
```

## Install Apps

Use the Citadel CLI:

```bash
# Install from registry
citadel-app install smart-notes

# Or install directly from URL
citadel-app install https://github.com/user/my-citadel-app
```

## License

Registry data is provided as-is. Individual apps are licensed under their own terms.
