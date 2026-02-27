#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC_DIR="$ROOT/data/apps/gym-tracker"
DST_DIR="$ROOT/external-apps/gym-tracker-next/data/gym-tracker"
mkdir -p "$DST_DIR"
if [[ -f "$SRC_DIR/db.sqlite" ]]; then
  cp "$SRC_DIR/db.sqlite" "$DST_DIR/db.sqlite"
  [[ -f "$SRC_DIR/db.sqlite-wal" ]] && cp "$SRC_DIR/db.sqlite-wal" "$DST_DIR/db.sqlite-wal"
  [[ -f "$SRC_DIR/db.sqlite-shm" ]] && cp "$SRC_DIR/db.sqlite-shm" "$DST_DIR/db.sqlite-shm"
  echo "Copied gym-tracker DB to $DST_DIR"
else
  echo "No existing gym-tracker DB found at $SRC_DIR"
fi
