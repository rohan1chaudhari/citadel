# Review Checklist

This document describes what maintainers check when reviewing app submissions to the Citadel Registry.

## Security Review

### Manifest Validation
- [ ] `id` is unique and follows naming conventions (lowercase, alphanumeric + hyphens)
- [ ] `id` matches the directory name and registry entry
- [ ] `manifest_version` is valid (`1.0` or `0.1.0`)
- [ ] Required fields are present: `id`, `name`, `version`, `permissions`
- [ ] Permissions are appropriate for the app's functionality (not overly broad)

### SQL Migration Safety
- [ ] Migrations do NOT contain `ATTACH` statements
- [ ] Migrations do NOT contain `DETACH` statements
- [ ] Migrations do NOT contain `PRAGMA` statements
- [ ] Migrations do NOT contain `VACUUM` statements
- [ ] Migrations do NOT use multi-statement SQL (no semicolons)
- [ ] Migrations use parameterized queries where applicable

### Repository Security
- [ ] Repository is publicly accessible
- [ ] No hardcoded secrets or API keys in the code
- [ ] No malicious code or obvious security vulnerabilities

## Quality Review

### Code Quality
- [ ] App follows Citadel conventions (uses `@citadel/core`, proper file structure)
- [ ] TypeScript is properly typed (no `any` abuse)
- [ ] No excessive console logging
- [ ] Error handling is present and reasonable

### User Experience
- [ ] App has a clear purpose and is functional
- [ ] UI uses Tailwind CSS and follows Citadel design patterns
- [ ] App handles loading and error states gracefully
- [ ] App is responsive (works on mobile and desktop)

### Documentation
- [ ] `README.md` explains what the app does
- [ ] App description is accurate and not misleading
- [ ] Screenshots are provided (optional but recommended)

## Metadata Accuracy

- [ ] App name matches the name in `app.yaml`
- [ ] Description is clear and concise
- [ ] Author name/alias is accurate
- [ ] Version follows semver (e.g., `0.1.0`)
- [ ] Repository URL is correct and accessible

## Verification Badge

The `verified` badge in the registry indicates:
1. The app has passed security review
2. The app has passed quality review
3. The app is maintained by a trusted author OR has been manually audited

Only maintainers can add the `verified` badge. Do not add it yourself in your PR.

## Review Timeline

- Initial automated checks: Immediate
- Maintainer review: Typically 1-3 days
- Follow-up requests: As needed

## Approval Criteria

An app is approved when:
1. All automated checks pass
2. All security review items pass
3. At least 3/4 quality review items pass
4. Metadata is accurate

## Post-Approval

Once approved:
1. The `verified` badge is added by a maintainer
2. The app appears in the Citadel CLI and UI
3. The app is listed on the showcase page
