# Screenshots

This directory contains screenshots for the README and documentation.

## Required Screenshots

The following screenshots should be captured and saved here:

| File | Description | How to Capture |
|------|-------------|----------------|
| `screenshot-home-grid.png` | Home page showing app grid | Run dev server, navigate to `/`, capture at 1280x800 |
| `screenshot-app-view.png` | An app running (e.g., Smart Notes) | Open Smart Notes app, capture main view |
| `screenshot-audit-viewer.png` | Audit log interface | Navigate to `/audit`, show filtered view |
| `screenshot-permissions.png` | Permission consent screen | Install a new app or reset permissions to trigger |

## Generating Screenshots

```bash
# Start the dev server
cd host && npm run dev

# Use your browser's dev tools or a tool like:
# - Chrome DevTools → Capture screenshot
# - Firefox → Screenshot node
# - Command line: npx playwright screenshot http://localhost:3000 screenshot.png
```

## Placeholder Images

Currently using placeholder images. To generate real screenshots:
1. Start the dev server: `cd host && npm run dev`
2. Navigate to each screen
3. Capture at 1280x800 resolution
4. Save as PNG in this directory
