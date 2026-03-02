# Deployment Guide

This guide covers deploying Citadel in production environments. Docker is the recommended deployment method.

## Table of Contents

- [Docker (Recommended)](#docker-recommended)
- [Bare Metal](#bare-metal)
- [Raspberry Pi](#raspberry-pi)
- [Tailscale for Remote Access](#tailscale-for-remote-access)
- [Troubleshooting](#troubleshooting)

---

## Docker (Recommended)

The easiest way to run Citadel is using Docker Compose. This method handles all dependencies and provides a consistent environment.

### Prerequisites

- Docker 20.10+ and Docker Compose v2+
- 1GB RAM minimum, 2GB recommended

### Quick Start

1. **Create a directory for your Citadel deployment:**

```bash
mkdir citadel
cd citadel
```

2. **Download the compose file:**

```bash
curl -O https://raw.githubusercontent.com/rohan1chaudhari/citadel/main/docker-compose.yml
```

3. **Create a data directory:**

```bash
mkdir -p data
```

4. **Start Citadel:**

```bash
docker compose up -d
```

Citadel will be available at `http://localhost:3000`.

### Docker Configuration

#### Environment Variables

Create a `.env` file in the same directory as your `docker-compose.yml`:

```bash
# Server configuration
CITADEL_PORT=3000

# Data directories (paths inside container)
CITADEL_DATA_ROOT=/app/data
CITADEL_APPS_DIR=/app/apps

# Backup settings
CITADEL_BACKUP_RETENTION=7
CITADEL_BACKUP_INTERVAL_HOURS=24

# Optional: LLM API keys for autopilot features
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Skip first-run setup wizard
CITADEL_SKIP_SETUP=false
```

#### Volume Mounts

The compose file mounts two directories from your host:

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./data` | `/app/data` | SQLite databases, storage, backups |
| `./apps` | `/app/apps` | External app installations |

Your data persists across container restarts and updates.

#### Updating

To update to the latest version:

```bash
docker compose pull
docker compose up -d
```

Your data in `./data` is preserved.

### Docker Compose Reference

```yaml
version: '3.8'

services:
  citadel:
    image: ghcr.io/rohan1chaudhari/citadel:latest
    ports:
      - "${CITADEL_PORT:-3000}:3000"
    volumes:
      - ./data:/app/data
      - ./apps:/app/apps
    environment:
      - CITADEL_DATA_ROOT=/app/data
      - CITADEL_APPS_DIR=/app/apps
      - CITADEL_BACKUP_RETENTION=${CITADEL_BACKUP_RETENTION:-7}
      - CITADEL_BACKUP_INTERVAL_HOURS=${CITADEL_BACKUP_INTERVAL_HOURS:-24}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - CITADEL_SKIP_SETUP=${CITADEL_SKIP_SETUP:-false}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
```

---

## Bare Metal

For advanced users who prefer running Citadel directly on the host without containers.

### Prerequisites

- Node.js 22+ (with `node:sqlite` support)
- npm 10+
- Git
- 1GB RAM minimum

### Installation Steps

1. **Clone the repository:**

```bash
git clone https://github.com/rohan1chaudhari/citadel.git
cd citadel
```

2. **Install dependencies:**

```bash
npm install
cd host && npm install && cd ..
cd core && npm install && cd ..
```

3. **Build the packages:**

```bash
cd core && npm run build && cd ..
cd host && npm run build && cd ..
```

4. **Create data directory:**

```bash
mkdir -p data/apps
```

5. **Start the server:**

```bash
cd host
npm start
```

Citadel will be available at `http://localhost:3000`.

### Systemd Service

Create a systemd service for auto-start on boot:

```bash
sudo tee /etc/systemd/system/citadel.service > /dev/null <<EOF
[Unit]
Description=Citadel Personal App Hub
After=network.target

[Service]
Type=simple
User=citadel
WorkingDirectory=/opt/citadel/host
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=CITADEL_DATA_ROOT=/opt/citadel/data
Environment=CITADEL_APPS_DIR=/opt/citadel/apps

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable citadel
sudo systemctl start citadel
```

### Reverse Proxy (Caddy)

Caddy is recommended for automatic HTTPS:

```bash
# Install Caddy
sudo apt install caddy

# Create Caddyfile
sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
citadel.example.com {
    reverse_proxy localhost:3000
}
EOF

# Reload Caddy
sudo systemctl reload caddy
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name citadel.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Raspberry Pi

Citadel works great on Raspberry Pi for home server deployments.

### Recommended Hardware

- **Raspberry Pi 4** (2GB+ RAM) or **Pi 5** (recommended)
- 32GB+ microSD card or USB SSD
- Ethernet connection (recommended over WiFi)

### Install Node.js

```bash
# Install Node.js 22.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v22.x.x
```

### Performance Notes

- **Pi 4 (2GB):** Suitable for 1-3 light apps
- **Pi 4 (4GB+):** Comfortable for 5-10 apps
- **Pi 5:** Excellent performance for 10+ apps
- Use an SSD instead of SD card for better SQLite performance

### ARM-Specific Considerations

Some npm packages may need compilation on ARM. Ensure you have build tools:

```bash
sudo apt-get install -y build-essential python3
```

### Docker on Raspberry Pi

Docker works well on Pi 4 and 5:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker pi

# Deploy Citadel
mkdir ~/citadel && cd ~/citadel
curl -O https://raw.githubusercontent.com/rohan1chaudhari/citadel/main/docker-compose.yml
mkdir -p data apps
docker compose up -d
```

---

## Tailscale for Remote Access

Tailscale is the recommended way to access Citadel remotely without exposing it to the public internet.

### Why Tailscale?

- **Secure:** WireGuard encryption, no open ports
- **Simple:** No firewall rules or DNS configuration
- **Free:** Personal use up to 20 devices
- **Fast:** Direct peer-to-peer connections

### Setup

1. **Install Tailscale on your Citadel server:**

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

2. **Authenticate:**

Follow the URL printed to link your device to your Tailscale account.

3. **Install Tailscale on your client devices:**

- **iOS/Android:** Download from app store
- **macOS/Windows:** Download from [tailscale.com](https://tailscale.com)
- **Linux:** Same install command as above

4. **Access Citadel:**

Your Citadel instance is available at:

```
http://<machine-name>:3000
```

Find your machine name with `tailscale status`.

### Optional: MagicDNS

Enable MagicDNS in the Tailscale admin console to use friendly hostnames like `http://myserver:3000`.

### Optional: HTTPS Certificates

Tailscale can provide valid HTTPS certificates:

```bash
sudo tailscale cert myserver.tailnet-name.ts.net
```

Use with a reverse proxy for secure HTTPS access within your tailnet.

---

## Troubleshooting

### Port Conflicts

**Error:** `EADDRINUSE: Address already in use :::3000`

**Solution:** Change the port in your `.env` file:

```bash
CITADEL_PORT=3001
```

Or for bare metal, set the environment variable:

```bash
PORT=3001 npm start
```

### Permission Errors

**Error:** `EACCES: permission denied, mkdir '/app/data'`

**Solution:** Ensure the data directory is writable:

```bash
# Docker
sudo chown -R 1000:1000 ./data ./apps

# Bare metal
sudo chown -R $USER:$USER /opt/citadel/data
```

### Node.js Version Issues

**Error:** `SQLite3 bindings not found` or `node:sqlite` errors

**Solution:** Upgrade to Node.js 22+:

```bash
# Check version
node --version

# Upgrade (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### SQLite on Older Systems

`node:sqlite` requires Node.js 22.14+ with SQLite support compiled in. If you see errors:

1. Upgrade Node.js to the latest LTS
2. Or use the Docker deployment (recommended for older systems)

### Build Failures

**Error:** `Cannot find module '@citadel/core'`

**Solution:** Build the core package first:

```bash
cd core && npm run build && cd ..
cd host && npm run build && cd ..
```

### Data Migration

To move data between deployments:

1. **Export from source:**
   - Per-app: Use the export button on the Status page
   - Full backup: Copy the `data/` directory

2. **Import to destination:**
   - Per-app: Use the import button
   - Full restore: Stop Citadel, replace `data/` directory, start Citadel

### Getting Help

- **GitHub Issues:** [github.com/rohan1chaudhari/citadel/issues](https://github.com/rohan1chaudhari/citadel/issues)
- **Documentation:** [docs.citadel.sh](https://docs.citadel.sh)
- **Discussions:** GitHub Discussions for Q&A
