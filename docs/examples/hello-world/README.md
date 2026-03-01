# Hello World Example App

A minimal Citadel app demonstrating the app package specification.

## Structure

```
hello-world/
├── app.yaml           # App manifest
├── README.md          # This file
└── migrations/        # Database migrations
    └── 001_initial.sql
```

## What It Demonstrates

- **Manifest**: Required and optional fields, permissions
- **Migrations**: Initial schema setup with sample data
- **Conventions**: File naming, directory structure

## Running

1. Copy this directory to `apps/hello-world/`
2. Install the app: `citadel-app install apps/hello-world`
3. Visit: `http://localhost:3000/apps/hello-world`

## Manifest Highlights

```yaml
id: hello-world          # Required: unique identifier
name: Hello World        # Required: display name
version: 0.1.0          # Required: semver
permissions:            # Required: declare what you need
  db:
    read: true
    write: true
```

## Migration Highlights

```sql
-- migrations/001_initial.sql
-- Runs once when app is first loaded
-- Use IF NOT EXISTS for idempotency
CREATE TABLE IF NOT EXISTS greetings (...);
```

## See Also

- [App Spec](../../app-spec.md) - Full specification
- [Runtime API](../../RUNTIME.md) - Host primitives
