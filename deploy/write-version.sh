#!/usr/bin/env bash
# Schreibt control/version.json aus dem aktuellen Git-Stand.
# Die App liest daraus ihre installierte Version für den Update-Vergleich.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/achilles-financials}"
cd "$APP_DIR"

mkdir -p control
printf '{"sha":"%s","deployedAt":"%s","branch":"%s"}\n' \
  "$(git rev-parse HEAD)" \
  "$(date -Iseconds)" \
  "$(git rev-parse --abbrev-ref HEAD)" \
  > control/version.json

# uid 1001 = App-Nutzer im Container (siehe Dockerfile)
chown -R 1001:1001 control 2>/dev/null || true

echo "control/version.json: $(cat control/version.json)"
