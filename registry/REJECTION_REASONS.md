# Rejection Reasons

This document explains what types of app submissions get rejected and why.

## Automatic Rejections

These issues will cause immediate rejection without review:

### 1. Security Violations

| Issue | Reason |
|-------|--------|
| `ATTACH` in migrations | Could allow cross-database access, breaking app isolation |
| `DETACH` in migrations | Could disrupt host database connections |
| `PRAGMA` in migrations | Could modify SQLite behavior globally |
| `VACUUM` in migrations | Could cause data corruption or locks |
| Multi-statement SQL (`;`) | Prevents proper transaction handling and guardrails |
| Hardcoded secrets | Security risk for users |
| Path traversal attempts | Violates storage isolation |

### 2. Malicious Code

| Issue | Reason |
|-------|--------|
| Code that exfiltrates data | Violates user privacy |
| Code that modifies other apps' data | Violates app isolation |
| Cryptocurrency mining | Abuse of user resources |
| Obfuscated code | Cannot verify safety |

### 3. Technical Issues

| Issue | Reason |
|-------|--------|
| Missing `app.yaml` | Required for registration |
| Invalid manifest | Cannot parse or validate |
| Duplicate app ID | Registry requires unique IDs |
| Inaccessible repository | Cannot verify code |
| App doesn't install | Broken functionality |

## Discretionary Rejections

These issues may result in rejection depending on severity:

### 1. Quality Concerns

| Issue | Typical Resolution |
|-------|------------------|
| No error handling | Request fixes |
| Poor TypeScript practices | Request fixes |
| Excessive console logging | Request fixes |
| No loading states | Request fixes or minor issue |
| UI doesn't match Citadel style | Minor issue |

### 2. Metadata Issues

| Issue | Typical Resolution |
|-------|------------------|
| Misleading description | Request fix |
| Incorrect author attribution | Request fix |
| Missing tags | Minor issue |
| No screenshot | Optional, not required |

### 3. Duplication

| Issue | Reason |
|-------|--------|
| App is a clone with minimal changes | Prefer original or significant improvements |
| Functionality already exists in verified app | Consider contribution instead |

### 4. Appropriateness

| Issue | Reason |
|-------|--------|
| Illegal content | Violates GitHub ToS |
| Adult content | Not suitable for general registry |
| Hate speech or harassment | Violates Code of Conduct |
| Malware or spyware | Security risk |

## Rejection Process

When rejecting a submission:

1. **Label the PR** with `rejected` and the specific reason tag
2. **Comment** explaining which criteria weren't met
3. **Link** to this document for reference
4. **Close** the PR after giving the author time to respond (usually 7 days)

## Appeals

If you believe your app was rejected in error:

1. Check that you've addressed all feedback
2. Comment on the closed PR with your reasoning
3. A different maintainer will review the appeal
4. New submissions with the same code will also be rejected

## Common Misconceptions

**"My app works on my machine"** — Working locally doesn't guarantee it meets security or quality standards.

**"It's just a small utility"** — All apps must meet baseline standards regardless of size.

**"I'll fix it later"** — Apps should be ready for users at submission time.

**"Why was X accepted but not mine?"** — Standards evolve. Older apps may have been submitted under different criteria.
