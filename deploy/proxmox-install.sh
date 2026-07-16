#!/usr/bin/env bash
# ============================================================================
#  Achilles Financials — Proxmox VE One-Shot Installer
#
#  Führt auf dem Proxmox-HOST aus:
#    1. Debian-12-LXC anlegen (unprivilegiert, nesting=1 für Docker)
#    2. Docker im Container installieren
#    3. Repo klonen, Image bauen, Container starten
#
#  Usage (auf dem Proxmox-Host als root):
#    bash proxmox-install.sh
#  oder direkt:
#    bash <(curl -fsSL https://raw.githubusercontent.com/lcsfls/achilles-financials/main/deploy/proxmox-install.sh)
#
#  Anpassbar über Umgebungsvariablen, z. B.:
#    CTID=120 STORAGE=local-zfs BRIDGE=vmbr0 bash proxmox-install.sh
# ============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/lcsfls/achilles-financials.git}"
HOSTNAME_CT="${HOSTNAME_CT:-achilles}"
STORAGE="${STORAGE:-local-lvm}"
BRIDGE="${BRIDGE:-vmbr0}"
DISK_GB="${DISK_GB:-8}"
MEMORY_MB="${MEMORY_MB:-2048}"
SWAP_MB="${SWAP_MB:-512}"
CORES="${CORES:-2}"
NET_IP="${NET_IP:-dhcp}"            # z. B. "192.168.1.50/24" für statisch
NET_GW="${NET_GW:-}"                # nur bei statischer IP nötig
APP_PORT="${APP_PORT:-3000}"

C_GOLD='\033[1;33m'; C_GREEN='\033[1;32m'; C_RED='\033[1;31m'; C_OFF='\033[0m'
log()  { echo -e "${C_GOLD}[achilles]${C_OFF} $*"; }
ok()   { echo -e "${C_GREEN}[achilles]${C_OFF} $*"; }
die()  { echo -e "${C_RED}[achilles] FEHLER:${C_OFF} $*" >&2; exit 1; }

command -v pct >/dev/null 2>&1 || die "Dieses Script muss auf einem Proxmox-VE-Host laufen (pct nicht gefunden)."
[[ $EUID -eq 0 ]] || die "Bitte als root ausführen."

# ---- CTID bestimmen -------------------------------------------------------
if [[ -z "${CTID:-}" ]]; then
  CTID=$(pvesh get /cluster/nextid)
fi
pct status "$CTID" &>/dev/null && die "Container $CTID existiert bereits. CTID=<frei> setzen."

# ---- Debian-12-Template sicherstellen --------------------------------------
log "Suche Debian-12-Template …"
pveam update >/dev/null
TEMPLATE=$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | sort -V | tail -1)
[[ -n "$TEMPLATE" ]] || die "Kein debian-12-standard-Template gefunden."
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE"; then
  log "Lade Template $TEMPLATE herunter …"
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

# ---- LXC anlegen ------------------------------------------------------------
NET0="name=eth0,bridge=${BRIDGE},ip=${NET_IP}"
[[ -n "$NET_GW" ]] && NET0="${NET0},gw=${NET_GW}"

log "Erstelle LXC $CTID ($HOSTNAME_CT): ${CORES} Cores, ${MEMORY_MB} MB RAM, ${DISK_GB} GB Disk …"
pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "$HOSTNAME_CT" \
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
for i in $(seq 1 30); do
  CT_IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}' || true)
  [[ -n "$CT_IP" ]] && break
  sleep 2
done
[[ -n "${CT_IP:-}" ]] || die "Container hat keine IP bekommen."
ok "Container läuft mit IP $CT_IP"

# ---- Docker + App installieren ----------------------------------------------
in_ct() { pct exec "$CTID" -- bash -lc "$*"; }

log "Installiere Docker (das dauert einen Moment) …"
in_ct "apt-get update -qq && apt-get install -y -qq curl git ca-certificates >/dev/null"
in_ct "curl -fsSL https://get.docker.com | sh >/dev/null 2>&1"

log "Klone Repository …"
in_ct "git clone --depth 1 $REPO_URL /opt/achilles-financials"

log "Baue und starte Achilles Financials (erster Build dauert einige Minuten) …"
in_ct "cd /opt/achilles-financials && APP_URL=http://${CT_IP}:${APP_PORT} docker compose up -d --build"

echo
ok "──────────────────────────────────────────────────────"
ok " Achilles Financials ist bereit! 🏛️"
ok ""
ok "   Dashboard:  http://${CT_IP}:${APP_PORT}"
ok "   Container:  LXC ${CTID} (${HOSTNAME_CT})"
ok "   Daten:      Docker-Volume 'achilles-data' im LXC"
ok ""
ok " Beim ersten Aufruf führt dich der Setup-Assistent"
ok " durch Sprache, Revolut-Verbindung und Demo-Daten."
ok ""
ok " Update später:"
ok "   pct exec ${CTID} -- bash -lc 'cd /opt/achilles-financials \\"
ok "     && git pull && docker compose up -d --build'"
ok "──────────────────────────────────────────────────────"
