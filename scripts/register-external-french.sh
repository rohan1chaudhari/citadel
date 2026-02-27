#!/usr/bin/env bash
set -euo pipefail

CITADEL_HOST="${CITADEL_HOST:-http://localhost:3000}"
APP_DIR="$(cd "$(dirname "$0")/../external-apps/french-translator-adapter" && pwd)"
MANIFEST_PATH="$APP_DIR/citadel.app.json"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "manifest not found: $MANIFEST_PATH" >&2
  exit 1
fi

PAYLOAD=$(jq -nc \
  --argjson manifest "$(cat "$MANIFEST_PATH")" \
  '{manifest:$manifest, upstreamBaseUrl:"http://localhost:4013", enabled:true}')

curl -sS -X POST "$CITADEL_HOST/api/apps" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD"

echo
