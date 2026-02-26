# Vision Agent Architecture

## Problem
The browser-based UI cannot directly spawn OpenClaw subagents. We need a bridge.

## Solution

### Option 1: OpenClaw Gateway Bridge (Recommended)
Expose an endpoint in OpenClaw gateway that the Next.js API can call to spawn agents.

```
Browser → Next.js API → OpenClaw Gateway /api/agent/spawn → Subagent spawned
                                    ↓
                              Subagent does work
                                    ↓
                              Writes state file
                                    ↓
Browser ← Next.js API ← State file ready
```

### Option 2: Agent-Initiated (Simpler)
When user clicks "Vision", the UI just creates a placeholder. 
The user then asks the assistant (me) to spawn the agent.

```
User: "Analyze smart-notes"
Assistant: Spawns subagent via sessions_spawn
Subagent: Explores → writes state → returns results
Assistant: "Done. [shows vision + tasks]"
```

### Option 3: Cron/Background Agent
Agent runs periodically or on git hooks, keeping state files updated.

---

## Implementation: Option 2 (Immediate)

Create a subagent that can be spawned manually:

```typescript
// Task for subagent
const task = `
You are a Vision Agent. Analyze the ${appId} app in citadel.

TOOLS: You have read, exec (for git), write, edit.

EXPLORE:
1. List /home/rohanchaudhari/personal/citadel/host/src/app/apps/${appId}/
2. List /home/rohanchaudhari/personal/citadel/host/src/app/api/apps/${appId}/
3. Run: cd /home/rohanchaudhari/personal/citadel && git log -5 --oneline -- host/src/app/apps/${appId} host/src/app/api/apps/${appId}
4. Read key files (page.tsx, route.ts, components)
5. Check for TODOs: grep -r "TODO\|FIXME" in app directories

ANALYZE:
- What features exist?
- What's working vs stubbed?
- What patterns are used?
- What natural next features would fit?

OUTPUT:
Write to: /home/rohanchaudhari/personal/citadel/kb/${appId}-state.md

Format:
---
lastAnalyzedCommit: [from git log]
lastAnalyzedAt: [ISO timestamp]
---

## Summary
...

## Features (IMPLEMENTED)
...

## Enhancement Opportunities
...

## New Feature Opportunities
...

Then return a JSON object with:
{
  "vision": "1-2 sentence inspiring vision",
  "tasks": [
    {"title": "(ENHANCEMENT) ...", "description": "...", "acceptanceCriteria": "..."},
    {"title": "(NEW FEATURE) ...", "description": "...", "acceptanceCriteria": "..."}
  ]
}
`;
```

---

## Usage

User says: "Analyze smart-notes for me"

I spawn subagent with above task.

Subagent explores, writes state file, returns JSON.

I present vision + tasks to user.

User can say "add these tasks to scrum board" and I create them via API.

---

## Future: Option 1

Add to OpenClaw gateway:

```typescript
// POST /api/agent/spawn
{
  "task": "...",
  "callbackUrl": "http://localhost:3000/api/agent/callback",
  "requesterSession": "..."
}
```

Gateway spawns subagent, when done it POSTs results to callbackUrl.
