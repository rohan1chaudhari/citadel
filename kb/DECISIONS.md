# DECISIONS.md

## Current architecture decisions

### 1) External-first apps
Internal app routes were removed/archived. Active apps are standalone external services behind host gateway.

### 2) Clean IDs are canonical
Canonical IDs:
- `french-translator`
- `gym-tracker`
- `smart-notes`
- `scrum-board`

Legacy `*-external` paths are redirects/aliases for compatibility.

### 3) Host role
Host is control plane:
- app registry
- gateway proxy
- permission policy
- shell/nav

App business logic lives in external app repos/folders.

### 4) Security model
Single-owner/local-trust model for current OSS baseline. Not multi-tenant by default.

### 5) Release baseline
- Tag: `v0.1.0`
- 4 external apps healthy and proxied
- recurring autopilot configured
