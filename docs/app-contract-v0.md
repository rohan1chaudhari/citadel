# Citadel App Contract v0

The App Contract v0 defines the interface between Citadel host and **standalone/containerized apps** that run outside the host process. This contract enables apps to be developed in any language/framework while maintaining integration with Citadel's permission system, health monitoring, and agent runtime.

## Overview

Unlike in-process Next.js apps that live in `host/src/app/apps/`, v0 contract apps:
- Run as separate processes or containers
- Communicate with the host via HTTP
- Self-declare their runtime requirements
- Expose a mandatory health endpoint

## Manifest Format

V0 manifests use `manifest_version: "0.1.0"` and include additional required fields.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique app identifier (1-64 chars, lowercase alphanumeric with hyphens) |
| `name` | string | Human-readable display name |
| `version` | string | Semantic version (e.g., "1.0.0") |
| `manifest_version` | string | Must be `"0.1.0"` for v0 contract |
| `entry` | object | Runtime entrypoint configuration |
| `health` | object | Health check configuration |
| `permissions` | object | Required permissions |

### Entry Configuration

The `entry` field defines how the host should run the app:

```yaml
entry:
  type: docker        # Runtime type: docker, binary, node, python, custom
  image: myapp:1.0    # Docker image (for docker type)
  port: 8080          # Port the app listens on
  env:                # Environment variables
    NODE_ENV: production
    LOG_LEVEL: info
```

#### Entry Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `docker` | Run as Docker container | `image` |
| `binary` | Run native executable | `command`, `port` |
| `node` | Run Node.js app | `command`, `port` |
| `python` | Run Python app | `command`, `port` |
| `custom` | Custom command | `command`, `port` |
| `nextjs` | Next.js app (special case) | None (runs in-process) |

#### Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Runtime type (required) |
| `command` | string | Start command (required for binary/node/python/custom) |
| `port` | number | Port to proxy requests to (required for standalone types) |
| `image` | string | Docker image reference (required for docker) |
| `build` | string | Path to Dockerfile or build context |
| `env` | object | Environment variables as key-value pairs |
| `workdir` | string | Working directory for the process |

### Health Configuration

**REQUIRED:** All v0 apps must expose `GET /healthz` for health checks.

```yaml
health:
  endpoint: /healthz      # Must be exactly "/healthz"
  interval: 30            # Check interval in seconds (default: 30)
  timeout: 5              # Timeout in seconds (default: 5)
  initialDelay: 5         # Initial delay before first check (default: 5)
```

The health endpoint should return:
- HTTP 200 with JSON `{"status": "healthy"}` when healthy
- HTTP 503 with JSON `{"status": "unhealthy"}` when unhealthy

### Optional Endpoints

Apps can optionally expose additional endpoints:

```yaml
endpoints:
  meta:                   # App metadata endpoint
    path: /meta           # Must be "/meta"
  events:                 # Event stream endpoint
    path: /events         # Must be "/events"
  agent:                  # Agent callback endpoint
    callback:
      path: /agent/callback  # Must be "/agent/callback"
```

#### `/meta` Endpoint

Returns app metadata:
```json
GET /meta
{
  "id": "my-app",
  "name": "My App",
  "version": "1.0.0",
  "description": "Does something useful",
  "endpoints": ["/healthz", "/meta", "/events"]
}
```

#### `/events` Endpoint

For event streaming (Server-Sent Events or WebSocket):
```
GET /events          # Subscribe to events
POST /events         # Publish an event
```

#### `/agent/callback` Endpoint

Receives agent runtime callbacks:
```
POST /agent/callback
{
  "taskId": "task-123",
  "status": "completed",
  "result": {...}
}
```

## Examples

### Example 1: Docker-based App (Python FastAPI)

```yaml
# app.yaml
id: python-api
name: Python API Service
version: 1.0.0
manifest_version: "0.1.0"
description: A standalone Python API running in Docker
author: Jane Doe
homepage: https://github.com/janedoe/python-api

entry:
  type: docker
  image: python-api:1.0
  port: 8000
  env:
    DATABASE_URL: sqlite:///data/db.sqlite
    LOG_LEVEL: info

health:
  endpoint: /healthz
  interval: 30
  timeout: 5

endpoints:
  meta:
    path: /meta
  events:
    path: /events

permissions:
  db:
    read: true
    write: true
  storage:
    read: true
    write: true
  network:
    - api.example.com
```

```python
# main.py (FastAPI example)
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/healthz")
async def healthz():
    return {"status": "healthy"}

@app.get("/meta")
async def meta():
    return {
        "id": "python-api",
        "name": "Python API Service",
        "version": "1.0.0",
        "endpoints": ["/healthz", "/meta", "/events"]
    }

@app.get("/events")
async def events():
    # SSE or event handling
    pass

@app.post("/api/data")
async def create_data():
    # Your API logic
    pass
```

### Example 2: Node.js Express App

```yaml
# app.yaml
id: node-service
name: Node.js Service
version: 2.1.0
manifest_version: "0.1.0"

entry:
  type: node
  command: node server.js
  port: 3000
  workdir: /app

health:
  endpoint: /healthz

permissions:
  db:
    read: true
    write: true
  ai: true
```

```javascript
// server.js (Express example)
const express = require('express');
const app = express();

app.use(express.json());

// Required health endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'healthy' });
});

// App routes
app.get('/api/users', (req, res) => {
  // Your logic
});

app.listen(3000, () => {
  console.log('Service running on port 3000');
});
```

### Example 3: Next.js App (Hybrid Mode)

Next.js apps can also use the v0 contract if they run as standalone servers:

```yaml
# app.yaml
id: nextjs-standalone
name: Next.js Standalone App
version: 1.0.0
manifest_version: "0.1.0"

entry:
  type: node
  command: node server.js  # Output of next build
  port: 3000

health:
  endpoint: /healthz

permissions:
  db:
    read: true
    write: true
  storage:
    read: true
    write: true
```

```javascript
// server.js (Next.js custom server)
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    
    // Health check endpoint
    if (parsedUrl.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
      return;
    }
    
    handle(req, res, parsedUrl);
  }).listen(3000);
});
```

### Example 4: Binary/Go App

```yaml
# app.yaml
id: go-service
name: Go Microservice
version: 1.0.0
manifest_version: "0.1.0"

entry:
  type: binary
  command: ./my-service
  port: 8080
  env:
    PORT: "8080"

health:
  endpoint: /healthz

permissions:
  db:
    read: true
    write: true
  network:
    - api.stripe.com
```

```go
// main.go
package main

import (
    "encoding/json"
    "net/http"
    "os"
)

func main() {
    http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
    })
    
    http.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
        // Your logic
    })
    
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    http.ListenAndServe(":"+port, nil)
}
```

## Host Integration

### Registration

When a v0 app is installed, the host:
1. Validates the manifest against the v0 schema
2. Pulls/builds the Docker image (if docker type)
3. Starts the app process/container
4. Begins health check polling
5. Registers the app in the gateway

### Request Routing

The host proxies requests to v0 apps:

```
User → Citadel Host → App Container/Process
          ↓
    GET /apps/my-app/*  →  http://localhost:{port}/*
    GET /api/apps/my-app/* → http://localhost:{port}/api/*
```

### Health Monitoring

The host continuously monitors `/healthz`:
- Healthy: App appears in UI, requests are routed
- Unhealthy: App marked degraded, requests may be queued or rejected
- Down: App removed from routing, error page shown

### Permission Enforcement

For v0 apps, permissions are enforced at the host gateway:
- Database access: Proxied through host's `@citadel/core`
- Storage: Host validates paths before proxying
- Network: Host validates outbound domains
- AI: Host validates AI API key before forwarding

## Migration from In-Process to Standalone

Existing in-process Next.js apps can migrate to v0:

1. Add `manifest_version: "0.1.0"`
2. Add `entry` configuration
3. Add `health` configuration with `/healthz` endpoint
4. Implement the health endpoint in your app
5. (Optional) Add `endpoints` for `/meta`, `/events`, `/agent/callback`

## Schema Reference

See the full JSON Schema at:
- File: `schema/citadel.app.json`
- URL: `https://citadel.dev/schema/app-v0.json`

## See Also

- [App Package Specification](./app-spec.md) - For in-process Next.js apps
- [Architecture](../architecture.md) - Host runtime and isolation model
- [API Reference](../api-reference.md) - Host primitives for apps
