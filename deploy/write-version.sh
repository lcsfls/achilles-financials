#!/usr/bin/env bash
# Schreibt control/version.json aus dem aktuellen Git-Stand.
# Die App liest daraus ihre installierte Version für den Update-Vergleich.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/achilles-financials}"
cd "$APP_DIR"

# Version kommt aus package.json — eine Quelle der Wahrheit, dieselbe, die auch
# getaggt wird. Der Commit dient nur noch der Diagnose.
VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)"
SHA="$(git rev-parse HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
# Steht der Commit auf einem Tag, ist das die verlässlichere Angabe
TAG="$(git describe --tags --exact-match 2>/dev/null || echo '')"
[[ -n "$TAG" ]] && VERSION="${TAG#v}"

mkdir -p control
printf '{"version":"%s","sha":"%s","deployedAt":"%s","branch":"%s"}\n' \
  "$VERSION" "$SHA" "$(date -Iseconds)" "$BRANCH" \
  > control/version.json

# uid 1001 = App-Nutzer im Container (siehe Dockerfile). Muss stimmen, bevor
# Docker das Verzeichnis bind-mountet — sonst legt Docker es als root an und
# die App kann ihre Update-Anforderung nicht schreiben.
chown -R "${APP_UID:-1001}:${APP_GID:-1001}" control 2>/dev/null || true
chmod 775 control 2>/dev/null || true

echo "control/version.json: $(cat control/version.json)"
