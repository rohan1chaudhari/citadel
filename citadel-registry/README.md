# Citadel App Registry

The official community registry for Citadel apps. This repository contains the `registry.json` file that powers the `citadel-app search` and `citadel-app install` commands.

## Registry Structure

Each entry in `registry.json` contains:

```json
{
  "id": "my-app",
  "name": "My App",
  "description": "A brief description of what the app does",
  "repo_url": "https://github.com/username/repo",
  "author": "Your Name",
  "tags": ["productivity", "tools"],
  "version": "0.1.0",
  "manifest_version": "1.0"
}
```

## Submitting an App

### Requirements

Before submitting, ensure your app meets these criteria:

1. **Valid manifest**: Must include `app.yaml` with required fields (`id`, `name`, `version`, `permissions`)
2. **Working app**: The app must install and run without errors
3. **Clear documentation**: README with setup instructions
4. **Appropriate content**: No malicious code, spam, or illegal content
5. **Unique ID**: App ID must not conflict with existing entries

### Submission Steps

1. Fork this repository
2. Add your app entry to `registry.json` (maintain alphabetical order by ID)
3. Submit a Pull Request with the PR template filled out
4. Wait for CI validation to pass
5. A maintainer will review and merge

### PR Template

```markdown
## App Submission

- **App ID**: my-app
- **Repository**: https://github.com/username/my-app
- **Author**: Your Name
- **Description**: One-line description

### Checklist

- [ ] I have read the submission guidelines
- [ ] My app has a valid `app.yaml` manifest
- [ ] My app installs and runs correctly
- [ ] The repository is publicly accessible
- [ ] I am the author or have permission to submit
```

## Using the Registry

### Search for apps

```bash
citadel-app search <query>
```

### Install an app

```bash
# By registry ID
citadel-app install my-app

# By URL (bypasses registry)
citadel-app install https://github.com/username/my-app
```

### List all apps

```bash
citadel-app search
```

## Registry API

The registry is served via GitHub's raw content CDN:

```
https://raw.githubusercontent.com/rohan1chaudhari/citadel-registry/main/registry.json
```

## Listing Criteria

### Acceptance

Apps will be accepted if they:
- Are functional and well-documented
- Follow Citadel app conventions
- Don't duplicate existing apps without differentiation
- Respect user privacy and security

### Rejection Reasons

Apps may be rejected if they:
- Don't have a valid `app.yaml` manifest
- Contain malware or security vulnerabilities
- Are incomplete or non-functional
- Violate the Code of Conduct

### Verification

Verified apps get a badge in the registry and priority listing. To get verified:
- App has been tested by a maintainer
- App has active maintenance (updates within 6 months)
- Author has a track record of quality submissions

## License

The registry data is licensed under MIT. Individual apps retain their own licenses.
