## App Submission

Thank you for submitting an app to the Citadel Registry! Please complete the checklist below to help us review your submission quickly.

### Submission Checklist

- [ ] I have read and agree to the [Review Checklist](REVIEW_CHECKLIST.md)
- [ ] My app has a unique `id` (lowercase, alphanumeric + hyphens only)
- [ ] My app includes a valid `app.yaml` manifest with all required fields
- [ ] My app's repository is publicly accessible
- [ ] My app includes at least one migration file in `migrations/`
- [ ] My migrations do NOT contain blocked SQL (ATTACH, DETACH, PRAGMA, VACUUM)
- [ ] My app's `id` in the manifest matches the `id` in registry.json
- [ ] I have tested my app with `citadel-app install <repo-url>`
- [ ] The app name and description are accurate and not misleading

### App Information

| Field | Value |
|-------|-------|
| App ID | <!-- e.g., my-awesome-app --> |
| App Name | <!-- e.g., My Awesome App --> |
| Author | <!-- Your name or GitHub username --> |
| Repository URL | <!-- https://github.com/... --> |
| Description | <!-- One-line description --> |

### Additional Notes

<!-- Anything else we should know about your app? -->

---

**Note:** Apps are reviewed manually for quality and security. Please be patient — we typically respond within a few days.
