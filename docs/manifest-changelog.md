# Manifest Schema Changelog

This document tracks all changes to the Citadel app manifest format (`app.yaml`).

## Versioning

The `manifest_version` field in `app.yaml` declares which version of the schema the manifest conforms to. The host validates manifests against their declared version.

## Supported Versions

| Version | Status | Description |
|---------|--------|-------------|
| `1.0`   | Stable | Initial stable manifest format |

## Version 1.0 (Current)

**Status:** Stable  
**Released:** 2026-03-01

### Required Fields

- `id` (string): Unique app identifier (lowercase alphanumeric with hyphens)
- `name` (string): Human-readable display name
- `version` (string): Semantic version (e.g., "1.0.0")
- `permissions` (object): Permission scopes for db, storage, ai, network

### Optional Fields

- `manifest_version` (string): Schema version. Defaults to "1.0" if not specified
- `description` (string): Short description of the app
- `icon` (string): Path to app icon
- `author` (string): Author or organization name
- `homepage` (string): URL to project homepage
- `dependencies` (string[]): Required host features or other apps
- `hidden` (boolean): Hide from home grid

### Example

```yaml
id: my-app
name: My App
version: 1.0.0
manifest_version: "1.0"
description: A sample Citadel app
permissions:
  db:
    read: true
    write: true
  storage:
    read: true
    write: false
  ai: true
  network:
    - api.example.com
```

### Schema Validation

Manifests are validated at registration time. Unknown `manifest_version` values produce a clear error listing supported versions.

### Migration Notes

When adding a new manifest version:

1. Update `SUPPORTED_MANIFEST_VERSIONS` in `core/src/registry.ts`
2. Add version-specific validation logic if needed
3. Document changes in this changelog
4. Update `MANIFEST_JSON_SCHEMA` in `core/src/manifest-schema.ts`

## Future Versions

| Version | Planned | Expected Changes |
|---------|---------|------------------|
| `1.1`   | TBD     | Optional `connectors` field formalization |
| `2.0`   | TBD     | Breaking changes (none planned) |
