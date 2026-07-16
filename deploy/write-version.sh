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

# uid 1001 = App-Nutzer im Container (siehe Dockerfile). Muss stimmen, bevor
# Docker das Verzeichnis bind-mountet — sonst legt Docker es als root an und
# die App kann ihre Update-Anforderung nicht schreiben.
chown -R "${APP_UID:-1001}:${APP_GID:-1001}" control 2>/dev/null || true
chmod 775 control 2>/dev/null || true

echo "control/version.json: $(cat control/version.json)"
