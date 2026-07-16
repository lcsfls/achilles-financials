#!/usr/bin/env bash
# ============================================================================
#  Achilles Financials — Update
#
#  Holt den aktuellen Stand aus dem Git-Repo und baut den Container neu.
#  Die SQLite-Datenbank im Volume bleibt unberührt.
#
#  Aufruf (im LXC / auf dem Docker-Host):
#      /opt/achilles-financials/deploy/update.sh
#  oder ohne lokales Repo-Wissen:
#      bash <(curl -fsSL https://raw.githubusercontent.com/lcsfls/achilles-financials/main/deploy/update.sh)
#
#  --from-app  wird vom systemd-Watcher gesetzt, wenn das Update aus der
#              Weboberfläche angestoßen wurde (schreibt Status für die App).
# ============================================================================
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/achilles-financials}"
# stable = neuester Versions-Tag (Standard), edge = Spitze des Branches
CHANNEL="${CHANNEL:-stable}"
CONTROL_DIR="$APP_DIR/control"
LOG_FILE="$CONTROL_DIR/update.log"
FROM_APP=0
[[ "${1:-}" == "--from-app" ]] && FROM_APP=1

C_GOLD='\033[1;33m'; C_GREEN='\033[1;32m'; C_RED='\033[1;31m'; C_OFF='\033[0m'
log() { echo -e "${C_GOLD}[achilles]${C_OFF} $*"; }
ok()  { echo -e "${C_GREEN}[achilles]${C_OFF} $*"; }

STARTED_AT="$(date -Iseconds)"
FROM_SHA=""
TO_SHA=""

# Der Container läuft als uid 1001 (siehe Dockerfile) und muss in dieses
# Verzeichnis schreiben können. Dieses Script läuft dagegen als root (systemd),
# erzeugt also root-eigene Dateien — deshalb nach JEDEM Schreiben zurückgeben,
# nicht erst am Ende: sonst sperrt schon ein fehlgeschlagenes Update die GUI aus.
APP_UID="${APP_UID:-1001}"
APP_GID="${APP_GID:-1001}"

fix_owner() {
  chown -R "${APP_UID}:${APP_GID}" "$CONTROL_DIR" 2>/dev/null || true
  chmod 775 "$CONTROL_DIR" 2>/dev/null || true
}

write_status() {
  [[ -d "$CONTROL_DIR" ]] || return 0
  local state="$1" msg="${2:-}"
  # Nur JSON-sichere Zeichen in die Statusdatei schreiben
  msg=$(printf '%s' "$msg" | tr -d '"\\' | tr '\n\r\t' '   ' | cut -c1-300)
  cat > "${CONTROL_DIR}/.status.tmp" <<EOF
{"state":"${state}","startedAt":"${STARTED_AT}","finishedAt":"$(date -Iseconds)","fromSha":"${FROM_SHA}","toSha":"${TO_SHA}","message":"${msg}"}
EOF
  mv -f "${CONTROL_DIR}/.status.tmp" "${CONTROL_DIR}/update-status.json"
  fix_owner
}

fail() {
  echo -e "${C_RED}[achilles] FEHLER:${C_OFF} $*" >&2
  write_status "error" "$*"
  exit 1
}

# Vom Watcher getriggert: Flag sofort entfernen, sonst löst systemd erneut aus
rm -f "$CONTROL_DIR/update-requested" 2>/dev/null || true

[[ -d "$APP_DIR/.git" ]] || fail "Kein Git-Repo unter $APP_DIR. APP_DIR=<pfad> setzen."
cd "$APP_DIR" || fail "Kann nicht nach $APP_DIR wechseln."
command -v docker >/dev/null 2>&1 || fail "Docker ist nicht installiert."

# Verzeichnis kann von Docker als root angelegt worden sein (Bind-Mount ohne
# vorhandenes Quellverzeichnis) — Besitzer daher immer zuerst geradeziehen.
mkdir -p "$CONTROL_DIR"
fix_owner
write_status "running" "Update gestartet"

FROM_SHA="$(git rev-parse HEAD 2>/dev/null || echo '')"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

echo "=== $(date -Iseconds) — update gestartet (von ${FROM_SHA:0:7}) ===" >> "$LOG_FILE"

log "Hole Änderungen von origin/${BRANCH} …"
if ! git fetch --tags --force origin "$BRANCH" >>"$LOG_FILE" 2>&1; then
  fail "git fetch fehlgeschlagen — Netzwerk oder Repo-Zugriff prüfen."
fi

# Zielstand bestimmen: höchster Versions-Tag oder Branch-Spitze
TARGET_REF="origin/${BRANCH}"
if [[ "$CHANNEL" == "stable" ]]; then
  LATEST_TAG="$(git tag -l 'v[0-9]*' --sort=-v:refname | head -1)"
  if [[ -n "$LATEST_TAG" ]]; then
    TARGET_REF="$LATEST_TAG"
    log "Neueste Version: ${LATEST_TAG}"
  else
    log "Keine Versions-Tags gefunden — nutze ${BRANCH}."
  fi
fi

TO_SHA="$(git rev-parse "$TARGET_REF" 2>/dev/null || echo '')"

if [[ -n "$FROM_SHA" && "$FROM_SHA" == "$TO_SHA" ]]; then
  ok "Bereits auf dem neuesten Stand (${FROM_SHA:0:7})."
  write_status "success" "Bereits aktuell"
  exit 0
fi

log "Aktualisiere ${FROM_SHA:0:7} → ${TO_SHA:0:7} (${TARGET_REF}) …"
if ! git reset --hard "$TARGET_REF" >>"$LOG_FILE" 2>&1; then
  fail "git reset fehlgeschlagen."
fi

# APP_URL aus dem laufenden Container übernehmen, damit der QR-Redirect passt
if [[ -z "${APP_URL:-}" ]]; then
  APP_URL="$(docker inspect achilles-financials --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
    | sed -n 's/^APP_URL=//p' | head -1)"
fi
if [[ -z "${APP_URL:-}" ]]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  APP_URL="http://${IP:-localhost}:${APP_PORT:-3000}"
fi
export APP_URL

log "Baue Container neu (das kann ein paar Minuten dauern) …"
if ! docker compose up -d --build >>"$LOG_FILE" 2>&1; then
  fail "docker compose build fehlgeschlagen — Details in $LOG_FILE"
fi

docker image prune -f >>"$LOG_FILE" 2>&1 || true

APP_DIR="$APP_DIR" "$APP_DIR/deploy/write-version.sh" >>"$LOG_FILE" 2>&1 || true

write_status "success" "Update auf ${TO_SHA:0:7} abgeschlossen"
echo "=== $(date -Iseconds) — update ok: ${FROM_SHA:0:7} -> ${TO_SHA:0:7} ===" >> "$LOG_FILE"

ok "Update abgeschlossen: ${FROM_SHA:0:7} → ${TO_SHA:0:7}"
[[ $FROM_APP -eq 0 ]] && ok "Dashboard: ${APP_URL}"
exit 0
