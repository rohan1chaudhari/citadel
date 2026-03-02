# How to Fork an App

Forking allows you to take an existing Citadel app and create your own customized version. The fork becomes an independent app with its own data and repository.

## Quick Start

```bash
# Fork an installed app
citadel-app fork smart-notes my-custom-notes

# Fork an app from the registry (auto-downloads if not installed)
citadel-app fork gym-tracker my-fitness-tracker
```

## What Forking Does

When you fork an app:

1. **Copies all source files** from the original app
2. **Updates the manifest** (`app.yaml`) with your new app ID
3. **Resets version** to `0.1.0` for your new fork
4. **Records the parent** in `forked_from` field for attribution
5. **Initializes a fresh git repo** (no history from parent)
6. **Creates a new database** (migrations run for the new app ID)

## Source Options

### Fork from Installed App

If you have the source app installed locally, it forks directly from disk:

```bash
citadel-app fork smart-notes my-notes
```

### Fork from Registry

If the app isn't installed, the CLI will:
1. Look up the app in the registry
2. Clone the repository
3. Create the fork from the clone

```bash
citadel-app fork gym-tracker my-tracker
# → Looking up "gym-tracker" in registry...
# → Found in registry: Gym Tracker
# → Repository: https://github.com/rohan1chaudhari/citadel-gym-tracker
# → Cloning source repository...
```

## After Forking

Your forked app is ready to customize:

```bash
# Edit the manifest
nano apps/my-notes/app.yaml

# Modify the UI
nano host/src/app/apps/my-notes/page.tsx

# Run the app
# 1. Start the host: cd host && npm run dev
# 2. Open: http://localhost:3000/apps/my-notes
```

## Fork vs. Create

| Feature | `fork` | `create` |
|---------|--------|----------|
| Starting point | Existing app | Template |
| Source code | Full app copied | Minimal scaffold |
| Database | Forked app's schema | Template's schema |
| Use case | Customizing existing apps | Building from scratch |

## Best Practices

1. **Rename thoughtfully** — The fork gets a new name based on your app ID. Update it in `app.yaml` if you want something different.

2. **Update README** — Replace the original README with your own to document your changes.

3. **Keep attribution** — The `forked_from` field is preserved automatically. Don't remove it if you publish your fork.

4. **Version reset** — Your fork starts at v0.1.0. Version independently from the parent.

5. **Git history** — The fork gets a fresh git repo. Add the original as a remote if you want to pull upstream changes:
   ```bash
   cd apps/my-fork
   git remote add upstream https://github.com/original/author/original-app
   ```

## Troubleshooting

### "App not found in registry"

The source app must be installed locally or available in the registry. Install it first:

```bash
citadel-app install <source-app-git-url>
citadel-app fork <source-app-id> <new-id>
```

### "Target directory already exists"

Choose a different app ID, or remove the existing directory:

```bash
rm -rf apps/<new-app-id>
citadel-app fork <source> <new-id>
```

### Fork fails during migration

If migrations fail, the fork is still created. Run migrations manually:

```bash
citadel-app migrate <new-app-id>
```

## Example: Complete Fork Workflow

```bash
# 1. Fork the app
citadel-app fork smart-notes my-knowledge-base

# 2. Navigate to the new app
cd apps/my-knowledge-base

# 3. Customize the manifest
# Edit app.yaml — change name, description, etc.

# 4. Customize the UI
# Edit host/src/app/apps/my-knowledge-base/page.tsx

# 5. Add new migrations if changing schema
# Create migrations/002_add_category.sql

# 6. Run migrations
citadel-app migrate my-knowledge-base

# 7. Test the app
# Start host and visit http://localhost:3000/apps/my-knowledge-base

# 8. Initialize your own git repo
git add .
git commit -m "Initial fork from smart-notes"
```

## See Also

- [`citadel-app create`](./build-an-app.md) — Create a new app from template
- [`citadel-app install`](./create-and-install-app.md) — Install an existing app
- [App Specification](../app-spec.md) — Manifest and structure reference
