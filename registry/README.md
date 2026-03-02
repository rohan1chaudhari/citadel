# Citadel Registry

The official registry for Citadel apps. This repository contains the JSON index of available apps that can be installed via the Citadel CLI.

## Quick Start

Browse and install apps:

```bash
# List all available apps
citadel-app search

# Install an app
citadel-app install smart-notes

# Or install directly from the registry URL
citadel-app install https://github.com/rohan1chaudhari/citadel-smart-notes
```

## Submitting an App

### Requirements

1. **Public Repository**: Your app must be in a public GitHub repository
2. **Valid Manifest**: Must include an `app.yaml` with required fields
3. **Migrations**: Must include SQL migrations in a `migrations/` folder
4. **Safe SQL**: Migrations must not contain `ATTACH`, `DETACH`, `PRAGMA`, or `VACUUM`
5. **Functionality**: App must be functional and have a clear purpose

### Submission Steps

1. Fork this repository
2. Add your app entry to `registry.json`
3. Create a pull request using the provided template
4. Wait for automated checks to pass
5. A maintainer will review your submission

### App Entry Format

```json
{
  "id": "my-app",
  "name": "My App",
  "description": "A short description of what the app does",
  "author": "Your Name",
  "version": "0.1.0",
  "tags": ["productivity", "notes"],
  "screenshot": "https://example.com/screenshot.png",
  "repository": "https://github.com/username/citadel-my-app",
  "manifest_version": "1.0",
  "verified": false
}
```

**Note:** Do not set `verified: true` yourself. This is added by maintainers after review.

### App Manifest Example

Your app's `app.yaml` should look like this:

```yaml
id: my-app
name: My App
description: A short description of what the app does
version: 0.1.0
manifest_version: "1.0"
permissions:
  db:
    read: true
    write: true
  storage:
    read: true
    write: false
  ai: false
```

## Registry Schema

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique lowercase identifier (alphanumeric + hyphens) |
| `name` | Yes | Display name for the app |
| `description` | Yes | Short description (1-2 sentences) |
| `author` | Yes | Author name or GitHub username |
| `version` | Yes | Semver version string |
| `tags` | No | Array of tag strings for categorization |
| `screenshot` | No | URL to screenshot image |
| `repository` | Yes | HTTPS URL to the app's repository |
| `manifest_version` | Yes | Manifest format version (`1.0` or `0.1.0`) |
| `verified` | No | Set by maintainers after review |
| `added_at` | No | ISO timestamp of when added to registry |

## Verified Badge

Apps marked with `"verified": true` have been reviewed by maintainers for:
- Security (safe SQL, no malicious code)
- Quality (functional, good UX)
- Accuracy (description matches functionality)

Only maintainers can add the verified badge.

## Review Process

1. **Automated Checks**: CI validates JSON syntax, manifest fields, and SQL safety
2. **Security Review**: Maintainer checks for blocked SQL patterns and security issues
3. **Quality Review**: Maintainer tests the app and checks code quality
4. **Approval**: If all checks pass, the app is merged and the `verified` badge may be added

See [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md) for the full checklist.

## Rejection Reasons

Submissions may be rejected for:
- Security violations (blocked SQL, malicious code)
- Technical issues (broken, missing manifest)
- Quality concerns (not functional, poor UX)
- Duplication (clone of existing app)
- Inappropriate content

See [REJECTION_REASONS.md](REJECTION_REASONS.md) for details.

## Using the Registry

The registry is fetched by:
- The Citadel CLI (`citadel-app search`)
- The Citadel host UI (browse apps page)
- The docs site (showcase page)

Registry URL: `https://raw.githubusercontent.com/rohan1chaudhari/citadel-registry/main/registry.json`

## Development

Validate the registry locally:

```bash
node -e "JSON.parse(require('fs').readFileSync('registry.json', 'utf8')); console.log('✅ Valid JSON');"
```

## License

This registry is provided as-is. Apps listed here are owned by their respective authors and licensed under their own terms.
