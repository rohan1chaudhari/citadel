# Security Policy

## Supported Versions

The following versions of Citadel are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Citadel, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities via email to:

**rohan1chaudhari@gmail.com**

Include the following details in your report:

- **Description**: A clear description of the vulnerability
- **Impact**: What could an attacker do if they exploited this?
- **Steps to reproduce**: Detailed steps to reproduce the vulnerability
- **Affected versions**: Which versions of Citadel are affected
- **Mitigation**: If known, suggestions for how to fix or mitigate the issue

### What to Expect

1. **Acknowledgment**: You will receive an acknowledgment within 48 hours
2. **Investigation**: We will investigate and validate the reported vulnerability
3. **Updates**: We will keep you informed about our progress
4. **Resolution**: Once fixed, we will coordinate disclosure timing with you

### Disclosure Policy

We follow a coordinated disclosure process:

1. Report received and acknowledged
2. Vulnerability verified and fixed
3. Security patch released
4. Public disclosure after users have had time to update

We aim to resolve critical vulnerabilities within 7 days and standard vulnerabilities within 30 days.

## Security Best Practices for Users

- Keep Citadel updated to the latest version
- Run Citadel behind a VPN or Tailscale for network-level security
- Review app permissions before granting them
- Regularly back up your data using the built-in export feature
- Use strong passphrases if the optional auth layer is enabled

## Security Features

Citadel includes several security features:

- **Per-app database isolation**: Each app has its own SQLite database
- **Permission system**: Apps must declare and get approval for permissions
- **Storage sandboxing**: Apps can only access their own storage directories
- **SQL guardrails**: Prevents dangerous SQL operations
- **Audit logging**: All operations are logged for review
- **CSP headers**: Content Security Policy protects against XSS attacks
- **Rate limiting**: Prevents abuse of API endpoints
