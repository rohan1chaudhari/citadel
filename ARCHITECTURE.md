# Citadel Architecture (current)

## Overview
Citadel is a local-first app hub with a host shell + pluggable external apps.

## Components
1. **Host (`host/`)**
   - Main UI shell/navigation
   - App registry (`/api/apps`)
   - Gateway proxy (`/api/gateway/apps/:id/proxy/*`)
   - Permission broker and enforcement

2. **Built-in apps (`apps/*`)**
   - Legacy/internal apps running in host monolith

3. **External apps (`external-apps/*`)**
   - Standalone services (Next.js or other)
   - Registered by manifest + upstream URL

## Data model
- Host stores app registry and permission overrides in Citadel DB.
- Each app should own its own data root/DB.
- Extraction strategy: copy DB first, keep rollback path.

## Routing model
- User opens `/apps/<id>`
- If app is external, host routes through gateway proxy
- Gateway forwards to configured upstream app URL

## Permissions
- Apps declare permissions in `citadel.app.json`
- Host resolves effective permissions via overrides
- Proxy/runtime endpoints enforce permission checks

## Current direction
- Move from monolithic submodule apps to independent containerized apps.
- Keep host as thin control plane + UX shell.
- Provide scaffolding CLI for rapid app creation/personalization.
