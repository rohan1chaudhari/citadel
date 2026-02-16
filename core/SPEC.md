# Citadel Platform Spec (MVP)

## App boundaries
- App code may only access:
  - Host-exposed DB API (scoped to app schema)
  - Host-exposed Storage API (scoped to app storage root)
  - Host-exposed Audit API
- Apps do not get raw DB credentials.
- Apps do not call external services directly (MVP).

## Orchestration
Lifecycle:
1) validate manifest
2) build
3) migrate
4) deploy
5) healthcheck
6) rollback if needed
