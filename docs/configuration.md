# Configuration

Citadel is configured through environment variables. All variables have sensible defaults, so you only need to set what you want to customize.

## Quick Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CITADEL_PORT` | Server port | `3000` | No |
| `CITADEL_DATA_ROOT` | Data directory path | `../data` | No |
| `CITADEL_APPS_DIR` | Apps directory path | `../apps` | No |
| `CITADEL_REPO_ROOT` | Repository root path | Auto-detected | No |
| `CITADEL_BACKUP_RETENTION` | Number of backups to keep | `7` | No |
| `CITADEL_BACKUP_INTERVAL_HOURS` | Hours between backups | `24` | No |
| `CITADEL_SKIP_SETUP` | Skip first-run setup wizard | `false` | No |
| `OPENAI_API_KEY` | OpenAI API key | - | For AI features |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | For AI features |

## Core Settings

### `CITADEL_PORT`
- **Type:** `number`
- **Default:** `3000`
- **Description:** The port the Citadel host server listens on.

```bash
CITADEL_PORT=8080
```

### `CITADEL_DATA_ROOT`
- **Type:** `string` (path)
- **Default:** `../data` (relative to repo root)
- **Description:** Directory where Citadel stores all application data, including SQLite databases and file storage.

```bash
CITADEL_DATA_ROOT=/var/lib/citadel/data
```

### `CITADEL_APPS_DIR`
- **Type:** `string` (path)
- **Default:** `../apps` (relative to repo root)
- **Description:** Directory where Citadel looks for installed applications.

```bash
CITADEL_APPS_DIR=/var/lib/citadel/apps
```

### `CITADEL_REPO_ROOT`
- **Type:** `string` (path)
- **Default:** Auto-detected (looks for `apps/` and `host/` directories)
- **Description:** The root of the Citadel repository. Usually auto-detected correctly, but can be explicitly set if needed.

```bash
CITADEL_REPO_ROOT=/opt/citadel
```

## Backup Settings

### `CITADEL_BACKUP_RETENTION`
- **Type:** `number`
- **Default:** `7`
- **Description:** Number of backups to retain. Older backups are automatically deleted.

```bash
CITADEL_BACKUP_RETENTION=14  # Keep 2 weeks of backups
```

### `CITADEL_BACKUP_INTERVAL_HOURS`
- **Type:** `number`
- **Default:** `24`
- **Description:** Interval between automatic backups in hours.

```bash
CITADEL_BACKUP_INTERVAL_HOURS=12  # Backup twice daily
```

## First-Run Settings

### `CITADEL_SKIP_SETUP`
- **Type:** `boolean` (`true`/`false`)
- **Default:** `false`
- **Description:** When `true`, skips the first-run setup wizard. Useful for automated deployments and Docker.

```bash
CITADEL_SKIP_SETUP=true
```

## LLM Provider Keys

These keys are required for AI-powered features (autopilot, vision suggestions, etc.).

### `OPENAI_API_KEY`
- **Type:** `string`
- **Required:** Yes, for AI features
- **Description:** Your OpenAI API key for GPT models.

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `ANTHROPIC_API_KEY`
- **Type:** `string`
- **Required:** Yes, for Claude Code runner
- **Description:** Your Anthropic API key for Claude models.

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Docker Deployment

When using Docker, environment variables are set in `docker-compose.yml`:

```yaml
environment:
  - CITADEL_DATA_ROOT=/app/data
  - CITADEL_APPS_DIR=/app/apps
  - CITADEL_BACKUP_RETENTION=7
  - CITADEL_BACKUP_INTERVAL_HOURS=24
  - OPENAI_API_KEY=${OPENAI_API_KEY:-}
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
```

You can also use an `.env` file alongside `docker-compose.yml`:

```bash
# .env file
cat > .env << 'EOF'
CITADEL_PORT=3000
CITADEL_BACKUP_RETENTION=7
OPENAI_API_KEY=sk-xxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
EOF
```

Then reference them in `docker-compose.yml`:

```yaml
environment:
  - OPENAI_API_KEY=${OPENAI_API_KEY}
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

## Development

For local development, create a `.env.local` file in the `host/` directory:

```bash
cd host/
cp .env.example .env.local
# Edit .env.local with your settings
```

## Environment File Examples

### Minimal (`.env`)

```bash
# Required for AI features
OPENAI_API_KEY=sk-xxxxxxxx
```

### Production Docker (`.env`)

```bash
# Server
CITADEL_PORT=3000

# Paths (Docker container paths)
CITADEL_DATA_ROOT=/app/data
CITADEL_APPS_DIR=/app/apps

# Backup
CITADEL_BACKUP_RETENTION=14
CITADEL_BACKUP_INTERVAL_HOURS=24

# Skip setup wizard
CITADEL_SKIP_SETUP=true

# API Keys
OPENAI_API_KEY=sk-xxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
```

### Development (`.env.local` in `host/`)

```bash
NODE_ENV=development
OPENAI_API_KEY=sk-xxxxxxxx
ELEVENLABS_API_KEY=eleven-xxxxxxxx
```
