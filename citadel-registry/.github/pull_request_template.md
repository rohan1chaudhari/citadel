# App Submission

Thank you for submitting an app to the Citadel Registry!

## Submission Details

- **App ID**: <!-- e.g., my-awesome-app -->
- **Repository**: <!-- https://github.com/username/repo -->
- **Author**: <!-- Your name or handle -->
- **Description**: <!-- One-line description -->

## Required Checklist

- [ ] I have read the [submission guidelines](../README.md#submitting-an-app)
- [ ] `registry.json` entry includes required fields (`id`, `name`, `description`, `repo_url`, `author`, `tags`, `version`, `manifest_version`)
- [ ] The app repository is publicly accessible on GitHub
- [ ] Repository contains a valid `app.yaml` with required manifest fields (`id`, `name`, `version`, `permissions`)
- [ ] I verified migrations do **not** contain blocked SQL (e.g., `ATTACH`)
- [ ] I can install the app with `citadel-app install <app-id>`
- [ ] I am the author or have permission to submit this app

## Reviewer Checklist (maintainers)

- [ ] Metadata is accurate and app ID is unique
- [ ] CI validation passed (manifest + repo reachability + migration SQL guardrail)
- [ ] Security review done (permissions minimal, no obvious abuse patterns)
- [ ] App quality review done (description matches behavior, basic functionality works)
- [ ] Decision recorded (merge / request changes / reject with reason)

## Optional Verification Request

<!-- Only checked by maintainers after review. -->
- [ ] Requesting `verified: true` badge consideration

## Notes

<!-- Any additional context for reviewers -->
