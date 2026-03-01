# Decisions log

- One Next.js host app (no separate Next.js apps)
- Same-process runtime (containers later)
- One SQLite DB per app: `data/apps/<appId>/db.sqlite`
- One storage root per app: `data/apps/<appId>/...`
- Generic SQL API with light guardrails
- Tailwind CSS for UI

## 2026-03-01: Stay with `node:sqlite` (do not migrate to `better-sqlite3`)

**Context:** Evaluate whether to migrate from `node:sqlite` to `better-sqlite3` based on stability, performance, and maintenance concerns.

**Current State:**
- Node.js version: v25.5.0
- Current SQLite module: `node:sqlite` (built-in)
- Stability status as of Node.js v25.7.0: **Release candidate (1.2)**
- No experimental warnings emitted in current configuration

**Research Findings:**

1. **Stability Timeline:**
   - v22.5.0: Introduced behind `--experimental-sqlite` flag (Stability 1.0)
   - v22.13.0 / v23.4.0: No longer requires flag, still experimental (Stability 1.1)
   - v25.7.0: Upgraded to **Release candidate (Stability 1.2)**
   - The module is progressing toward stability but not yet at Stability 2 (Stable)

2. **Performance Comparison:**
   - `better-sqlite3`: ~10-20% faster in most benchmarks
   - `node:sqlite`: Comparable to `node-sqlite3`, slower than `better-sqlite3`
   - For Citadel's use case (personal app hub, moderate load), the performance difference is negligible

3. **Trade-offs:**

   | Factor | `node:sqlite` | `better-sqlite3` |
   |--------|---------------|------------------|
   | Native compilation | Not required | Required (node-gyp) |
   | Deployment complexity | Zero | Higher (build tools needed) |
   | Performance | Good | Better |
   | API stability | Release candidate (1.2) | Stable |
   | Bundle size | Built-in | ~5MB + native binary |
   | Maintenance burden | Low (Node.js team) | Moderate (community) |

4. **Risk Assessment:**
   - **Breaking changes:** Low. The API has remained consistent since v22.5.0
   - **Future-proofing:** Node.js team is committed to backward compatibility once Stable
   - **Migration path:** If needed later, migration is straightforward (similar APIs)

**Decision: STAY with `node:sqlite`**

**Rationale:**
1. **No urgent need:** Current implementation works without experimental warnings
2. **Simpler deployment:** No native compilation needed, works on any Node.js v22+
3. **Good enough performance:** For a personal app hub, the difference is imperceptible
4. **Converging to stable:** Release candidate status indicates the API is settling
5. **Lower maintenance:** Built-in module means fewer dependencies to manage

**Action Items:**
- [x] Document decision in DECISIONS.md
- [ ] Monitor Node.js release notes for v26+ stabilization
- [ ] Re-evaluate if performance becomes a bottleneck

**If migration ever needed:**
```typescript
// Migration is straightforward - API patterns are similar:
// node:sqlite:  new DatabaseSync(path)
// better-sqlite3: new Database(path)
// Both support: prepare(), run(), all(), exec()
```
