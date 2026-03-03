# Citadel App Registry

The official community registry for Citadel apps. This repository contains the `registry.json` index consumed by `citadel-app search` and `citadel-app install`.

## Registry Structure

Top-level shape:

```json
{
  "version": "1.0.0",
  "updated_at": "2026-03-03T02:27:00Z",
  "apps": [
    {
      "id": "my-app",
      "name": "My App",
      "description": "A brief description",
      "repo_url": "https://github.com/username/repo",
      "author": "Your Name",
      "tags": ["productivity"],
      "version": "0.1.0",
      "manifest_version": "1.0",
      "verified": false
    }
  ]
}
```

`verified` is optional and set by maintainers only.

## Submitting an App

1. Fork this repository.
2. Add your app to `registry.json` under `apps` (keep IDs unique and sorted).
3. Open a Pull Request and complete the template.
4. CI validates your submission automatically.
5. Maintainers review and either merge, request changes, or reject with reasons.

### CI Validation (required)

On every PR touching `registry.json`, CI checks:

- Registry JSON schema and required app fields
- `repo_url` is reachable
- `app.yaml` exists and includes required fields (`id`, `name`, `version`, `permissions`)
- Migration SQL guardrail: rejects `ATTACH` in `migrations/*.sql`

## Review Checklist (maintainers)

Every accepted app should pass:

- Security review (permissions are scoped, no obviously dangerous patterns)
- Quality review (app works, README exists, metadata is accurate)
- Policy review (no spam/malware/illegal content)
- Decision traceability (clear outcome in PR discussion)

## Verified Badge

Maintainers may set `"verified": true` when all are true:

- App has passed manual functional testing
- Repository is actively maintained
- Author has a reliable submission history or equivalent trust signal

Verified apps can be prioritized in UI listings.

## Rejection Reasons

A submission may be rejected for:

- Missing/invalid `app.yaml`
- Repository inaccessible or broken install path
- Blocked SQL usage (`ATTACH`) in migrations
- Misleading metadata (description does not match app behavior)
- Security/privacy concerns (overbroad permissions, suspicious code)
- Spam, plagiarism, illegal content, or Code of Conduct violations

Rejected submissions should receive explicit reasons so authors can resubmit.

## Registry URL

```
https://raw.githubusercontent.com/rohan1chaudhari/citadel-registry/main/registry.json
```

## License

Registry metadata is MIT-licensed. Individual apps keep their own licenses.
