# Data Protection Implementation

## Overview
This system prevents accidental database deletion through multiple layers of protection.

## Protection Layers

### 1. Immutable Database Files (Linux/macOS)
- Uses `chattr +i` (Linux) or `chflags uchg` (macOS)
- Database files cannot be deleted or modified without explicit unprotection
- Automatic protection applied on startup

### 2. Safe File Operations
- `scripts/safe-fs.mjs` provides drop-in replacements for dangerous fs operations
- Blocks direct deletion of database files
- Requires use of `safe-delete.mjs` script

### 3. Pre-Deletion Validation
- Requires recent backup before allowing deletion
- Logs all deletion attempts
- Multi-step confirmation for bulk operations

### 4. Mass Data Loss Detection
- Detects when multiple databases are fresh (recently created)
- Alerts on startup if suspicious patterns found
- Monitors for empty databases

### 5. Preflight Checks
- `scripts/preflight-check.mjs` validates system state
- Checks backup health and data integrity
- Run before any dangerous operation

## Usage

### Protecting Databases
```typescript
import { protectDatabase, unprotectDatabase } from '@citadel/core';

// Make a database immutable
await protectDatabase('gym-tracker');

// Temporarily unprotect for maintenance
await unprotectDatabase('gym-tracker');
// ... perform operations ...
await protectDatabase('gym-tracker');
```

### Safe Deletion
```bash
# Create backup and delete (with confirmation)
node scripts/safe-delete.mjs gym-tracker

# Force deletion without confirmation (still creates backup)
node scripts/safe-delete.mjs gym-tracker --force
```

### Preflight Check
```bash
# Run before any data operation
node scripts/preflight-check.mjs
```

## Recovery

If databases are deleted despite protections:

1. Check `data/backups/emergency/` for deletion logs
2. Check `data/backups/` for scheduled backups
3. Restore from backup: `cp backup-file.sqlite data/apps/{appId}/db.sqlite`
4. Restart the server

## Platform Support

- **Linux**: Full support (chattr)
- **macOS**: Full support (chflags)
- **Windows**: Protection via safe-fs module only (no OS-level immutability)
