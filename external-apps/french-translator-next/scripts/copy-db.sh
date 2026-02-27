#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC_DIR="$ROOT/data/apps/french-translator"
DST_DIR="$ROOT/external-apps/french-translator-next/data"

mkdir -p "$DST_DIR"

if [[ -f "$SRC_DIR/db.sqlite" ]]; then
  cp "$SRC_DIR/db.sqlite" "$DST_DIR/db.sqlite"
  [[ -f "$SRC_DIR/db.sqlite-wal" ]] && cp "$SRC_DIR/db.sqlite-wal" "$DST_DIR/db.sqlite-wal"
  [[ -f "$SRC_DIR/db.sqlite-shm" ]] && cp "$SRC_DIR/db.sqlite-shm" "$DST_DIR/db.sqlite-shm"
  echo "Copied French Translator DB to $DST_DIR"
else
  echo "No existing French Translator DB found at $SRC_DIR (nothing to copy)."
fi
