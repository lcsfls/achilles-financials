#!/usr/bin/env bash
# ============================================================================
#  Achilles Financials — Proxmox VE One-Shot Installer
#
#  Auf dem Proxmox-HOST ausführen. Legt an:
#    1. Debian-12-LXC (unprivilegiert, nesting=1 für Docker)
#    2. Docker im Container
#    3. Repo-Klon, Image-Build, Container-Start
#    4. systemd-Watcher für Updates aus der Weboberfläche
#
#  Einzeiler:
#    bash <(curl -fsSL https://raw.githubusercontent.com/lcsfls/achilles-financials/main/deploy/proxmox-install.sh)
#
#  Der Storage wird automatisch erkannt: Gibt es nur einen, wird er genommen,
#  bei mehreren fragt das Script nach. Vorgeben geht per STORAGE=<name>
#  (Namen anzeigen mit: pvesm status --content rootdir).
#
#  Anpassbar per Umgebungsvariablen, z. B.:
#    CTID=120 STORAGE=local-zfs NET_IP=192.168.1.50/24 NET_GW=192.168.1.1 \
#      bash <(curl -fsSL .../proxmox-install.sh)
# ============================================================================
set -euo pipefail

REPO_SLUG="${REPO_SLUG:-lcsfls/achilles-financials}"
REPO_URL="${REPO_URL:-https://github.com/${REPO_SLUG}.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
HOSTNAME_CT="${HOSTNAME_CT:-achilles}"
STORAGE="${STORAGE:-}"                  # leer = automatisch erkennen / nachfragen
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-}"
BRIDGE="${BRIDGE:-vmbr0}"
DISK_GB="${DISK_GB:-8}"
MEMORY_MB="${MEMORY_MB:-2048}"
SWAP_MB="${SWAP_MB:-512}"
CORES="${CORES:-2}"
NET_IP="${NET_IP:-dhcp}"            # z. B. "192.168.1.50/24" für statisch
NET_GW="${NET_GW:-}"                # nur bei statischer IP nötig
APP_PORT="${APP_PORT:-3000}"
APP_DIR="/opt/achilles-financials"

# Ohne --password hat root im Container gar kein Passwort — Zugang ginge nur
# über `pct enter` vom Host. Deshalb eins erzeugen und am Ende anzeigen.
# CT_PASSWORD=<eigenes> setzt ein selbst gewähltes.
CT_PASSWORD="${CT_PASSWORD:-$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 20)}"

C_GOLD='\033[1;33m'; C_GREEN='\033[1;32m'; C_RED='\033[1;31m'; C_OFF='\033[0m'
log()  { echo -e "${C_GOLD}[achilles]${C_OFF} $*"; }
ok()   { echo -e "${C_GREEN}[achilles]${C_OFF} $*"; }
die()  { echo -e "${C_RED}[achilles] FEHLER:${C_OFF} $*" >&2; exit 1; }

command -v pct >/dev/null 2>&1 || die "Dieses Script muss auf einem Proxmox-VE-Host laufen (pct nicht gefunden)."
[[ $EUID -eq 0 ]] || die "Bitte als root ausführen."

# ---- Storage-Auswahl --------------------------------------------------------
# Storage-Namen sind pro Host verschieden (local-lvm, local-zfs, tank, …),
# deshalb nichts raten: aktive Storages abfragen und ggf. nachfragen.

# Liest auch, wenn das Script via Prozess-Substitution läuft; bei `curl | bash`
# ist stdin die Pipe, dann über /dev/tty.
read_tty() {
  if [[ -t 0 ]]; then read -r "$@"
  elif [[ -r /dev/tty ]]; then read -r "$@" < /dev/tty
  else return 1
  fi
}

# Aktive Storages, die den gewünschten Inhaltstyp können (rootdir | vztmpl)
list_storages() {
  pvesm status --content "$1" 2>/dev/null | awk 'NR>1 && $3=="active" {print $1}'
}

storage_table() {
  pvesm status --content "$1" 2>/dev/null | awk 'NR==1 || $3=="active"'
}

# choose_storage <content> <label> <vorgabe>  → gewählter Storage auf stdout
choose_storage() {
  local content="$1" label="$2" preset="${3:-}"
  local -a opts=()
  while IFS= read -r line; do [[ -n "$line" ]] && opts+=("$line"); done < <(list_storages "$content")

  if [[ ${#opts[@]} -eq 0 ]]; then
    die "Kein aktiver Storage für ${label} gefunden (Inhaltstyp '${content}').
       Prüfen mit:  pvesm status --content ${content}
       In der Proxmox-UI: Datacenter → Storage → Storage bearbeiten → Content '${content}' aktivieren."
  fi

  # Explizit gesetzt → nur prüfen, ob es ihn gibt
  if [[ -n "$preset" ]]; then
    local s
    for s in "${opts[@]}"; do
      [[ "$s" == "$preset" ]] && { echo "$preset"; return 0; }
    done
    die "Storage '${preset}' existiert nicht oder kann kein '${content}'.
       Verfügbar: ${opts[*]}"
  fi

  # Genau einer → nehmen
  if [[ ${#opts[@]} -eq 1 ]]; then
    echo "${opts[0]}"
    return 0
  fi

  # Mehrere → fragen
  {
    echo
    echo -e "${C_GOLD}[achilles]${C_OFF} Mehrere Storages für ${label} verfügbar:"
    echo
    storage_table "$content" | sed 's/^/    /'
    echo
  } >&2

  local i choice
  for i in "${!opts[@]}"; do
    echo -e "    $((i + 1))) ${opts[$i]}" >&2
  done
  echo >&2

  while true; do
    echo -ne "${C_GOLD}[achilles]${C_OFF} Nummer wählen [1-${#opts[@]}] (Enter = 1): " >&2
    if ! read_tty choice; then
      die "Keine Eingabe möglich (kein Terminal). Storage direkt angeben, z. B.:
       STORAGE=${opts[0]} bash <(curl -fsSL .../proxmox-install.sh)"
    fi
    [[ -z "$choice" ]] && choice=1
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#opts[@]} )); then
      echo "${opts[$((choice - 1))]}"
      return 0
    fi
    echo -e "${C_RED}    Ungültige Eingabe.${C_OFF}" >&2
  done
}

STORAGE="$(choose_storage rootdir "den Container (rootfs)" "$STORAGE")"
TEMPLATE_STORAGE="$(choose_storage vztmpl "das Debian-Template" "$TEMPLATE_STORAGE")"
ok "Storage: ${STORAGE} (rootfs) · ${TEMPLATE_STORAGE} (Template)"

# ---- CTID bestimmen ---------------------------------------------------------
if [[ -z "${CTID:-}" ]]; then
  CTID=$(pvesh get /cluster/nextid)
fi
pct status "$CTID" &>/dev/null && die "Container $CTID existiert bereits. CTID=<frei> setzen."

# ---- Debian-12-Template sicherstellen ---------------------------------------
log "Suche Debian-12-Template …"
pveam update >/dev/null
TEMPLATE=$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | sort -V | tail -1)
[[ -n "$TEMPLATE" ]] || die "Kein debian-12-standard-Template gefunden."
if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
  log "Lade Template $TEMPLATE herunter …"
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

# ---- LXC anlegen ------------------------------------------------------------
NET0="name=eth0,bridge=${BRIDGE},ip=${NET_IP}"
[[ -n "$NET_GW" ]] && NET0="${NET0},gw=${NET_GW}"

log "Erstelle LXC $CTID ($HOSTNAME_CT): ${CORES} Cores, ${MEMORY_MB} MB RAM, ${DISK_GB} GB Disk …"
pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "$HOSTNAME_CT" \
  --password "$CT_PASSWORD" \
  --unprivileged 1 \
  --features nesting=1,keyctl=1 \
  --cores "$CORES" \
  --memory "$MEMORY_MB" \
  --swap "$SWAP_MB" \
  --rootfs "${STORAGE}:${DISK_GB}" \
  --net0 "$NET0" \
  --onboot 1 \
  --start 1

log "Warte auf Netzwerk im Container …"
for _ in $(seq 1 30); do
  CT_IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}' || true)
  [[ -n "${CT_IP:-}" ]] && break
  sleep 2
done
[[ -n "${CT_IP:-}" ]] || die "Container hat keine IP bekommen."
ok "Container läuft mit IP $CT_IP"

in_ct() { pct exec "$CTID" -- bash -lc "$*"; }

# ---- Docker + App -----------------------------------------------------------
log "Installiere Docker (dauert einen Moment) …"
in_ct "apt-get update -qq && apt-get install -y -qq curl git ca-certificates >/dev/null"
in_ct "curl -fsSL https://get.docker.com | sh >/dev/null 2>&1"

log "Klone Repository …"
in_ct "git clone --branch '$REPO_BRANCH' '$REPO_URL' '$APP_DIR'"

APP_URL="http://${CT_IP}:${APP_PORT}"

# Control-Kanal für In-App-Updates: die App (uid 1001) schreibt hier hinein
log "Richte Update-Kanal ein …"
in_ct "chmod +x '$APP_DIR/deploy/'*.sh"
in_ct "APP_DIR='$APP_DIR' '$APP_DIR/deploy/write-version.sh'"

# systemd-Watcher: startet update.sh, sobald die App eine Anforderung ablegt
in_ct "install -m 644 '$APP_DIR/deploy/achilles-update.service' /etc/systemd/system/achilles-update.service"
in_ct "install -m 644 '$APP_DIR/deploy/achilles-update.path' /etc/systemd/system/achilles-update.path"
in_ct "systemctl daemon-reload && systemctl enable --now achilles-update.path >/dev/null 2>&1"

# Konfiguration für Compose festhalten — auch spätere Updates lesen diese .env
in_ct "printf 'APP_URL=%s\nAPP_PORT=%s\nREPO_SLUG=%s\nREPO_BRANCH=%s\n' '$APP_URL' '$APP_PORT' '$REPO_SLUG' '$REPO_BRANCH' > '$APP_DIR/.env'"

log "Baue und starte Achilles Financials (erster Build dauert einige Minuten) …"
in_ct "cd '$APP_DIR' && docker compose up -d --build"

echo
ok "──────────────────────────────────────────────────────"
ok " Achilles Financials ist bereit! 🏛️"
ok ""
ok "   Dashboard:  ${APP_URL}"
ok "   Container:  LXC ${CTID} (${HOSTNAME_CT})"
ok "   Daten:      Docker-Volume 'achilles-data'"
ok ""
ok " ┌─ Container-Zugang ─────────────────────────────────"
ok " │  Benutzer:  root"
ok " │  Passwort:  ${CT_PASSWORD}"
ok " │"
ok " │  Jetzt notieren — es wird nicht erneut angezeigt."
ok " │  Ändern:    pct exec ${CTID} -- passwd"
ok " │  Ohne Passwort rein:  pct enter ${CTID}"
ok " └────────────────────────────────────────────────────"
ok ""
ok " Beim ersten Aufruf führt dich der Setup-Assistent"
ok " durch Sprache, Revolut-Verbindung und Demo-Daten."
ok ""
ok " Updates:"
ok "   · in der App unter Einstellungen → Updates"
ok "   · oder per Shell vom Proxmox-Host:"
ok "       pct exec ${CTID} -- ${APP_DIR}/deploy/update.sh"
ok "──────────────────────────────────────────────────────"
