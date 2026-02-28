# Security Policy

## Reporting
If you find a security issue, open a private report first (GitHub Security Advisory preferred).
If unsure, open an issue and ask for private follow-up.

## Citadel trust model (current)
Citadel is designed for a **personal/single-owner** deployment model.

- Authenticated local operators are trusted for that host.
- Session/app IDs are routing keys, not multi-tenant authorization boundaries.
- For mixed-trust users, run separate Citadel instances (or separate hosts/OS users).

## Defaults and boundaries
- Local-first runtime is the default assumption.
- External apps run behind gateway/proxy contracts.
- App permissions are declaration + policy override based.

## Out of scope
- Multi-tenant adversarial isolation on one shared Citadel instance.
- Vulnerabilities requiring local trusted operator config/file write access only.
- Prompt-injection-only reports without boundary bypass.

## Recommended hardening
- Keep secrets in env only (`.env*`), never commit secrets.
- Keep local certs and sqlite data out of git.
- Use production service supervision for runtime stability.
