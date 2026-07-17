# 🏛️ Achilles Financials

**Self-hosted private wealth dashboard.** Connect your bank by scanning a QR code, then track
categorized spending, precious metals, investments with live prices and your pension — and simulate
your path to financial independence. Dark glassmorphism UI with a gold accent.

Works with **2,700+ banks across 30 European countries** through
[Enable Banking](https://enablebanking.com)'s PSD2 interface — read-only, revocable, and everything
stays on your own server.

> ⚡ **This project is 100 % vibe-coded.** Every line — app, design, deployment scripts, this README —
> was written by an AI coding agent ([Claude Code](https://claude.com/claude-code)) in conversation.
> No human wrote a single line of code. Review it accordingly before trusting it with your finances. 🤖

---

## Features

| | |
|---|---|
| 🏦 **Any European bank, by QR code** | Pick your country, search your bank, scan the QR code with your phone, approve in your banking app. Achilles pulls up to 12 months of history — balances and transactions only, never payment access. |
| 📄 **CSV import** | No API account needed: export a statement from your banking app and upload it. Duplicate-safe, understands English and German column headers. |
| 🏷️ **Auto-categorization** | Rule-based categories (groceries, subscriptions, housing, …). Manual overrides stick and survive re-syncs. |
| 🥇 **Precious metals** | Track every purchase as its own lot — grams, cost basis, date, dealer. Live spot prices for gold, silver, platinum and palladium show current value and P/L per lot and per metal. |
| 📈 **Investments + live prices** | Stocks, ETFs, crypto. Add a Yahoo-format symbol (`AAPL`, `VWCE.DE`, `BTC-EUR`) and refresh every price with one click, including USD→EUR conversion. |
| 👀 **Watchlist** | Watch any symbol with its price and daily change. |
| 🔥 **FIRE simulator** | Inflation-adjusted wealth projection, your FIRE number, and years to financial independence — interactive sliders, seeded from your real net worth. |
| 🐷 **Pension tracking** | Log balances from your pension statements; the latest one feeds into net worth and the FIRE simulation. |
| 🌍 **English & German** | Pick your language in the first-run setup wizard; switch anytime. Number and date formats follow. |
| ⬆️ **Self-updating** | Settings → Updates shows what's new since your version and installs it on click. Or one line in the shell. |
| 🔐 **Login** | Username + password (scrypt), enabled in Settings. Off by default so a fresh install can't lock you out — turn it on before anyone else can reach the host. |
| 💾 **Encrypted backup** | Settings → Backup downloads a password-protected `.achillesbak` (AES-256-GCM). It contains your banking private key, so it's never written in the clear — and never restorable without the password. |
| 🔒 **Private by design** | One SQLite file on your server. Outbound calls go only to public price/FX APIs and your bank's PSD2 endpoint — no analytics, no cloud, no middleman holding your data. |

## Quick start (local)

```bash
git clone https://github.com/lcsfls/achilles-financials.git
cd achilles-financials
npm install
npm run dev        # → http://localhost:3000
```

The setup wizard walks you through language, the optional bank connection, and demo data. Demo mode
fills the dashboard with realistic sample data so you can explore before connecting anything real.

## Deployment

### Proxmox — one command

Run on your Proxmox VE host as root:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/lcsfls/achilles-financials/main/deploy/proxmox-install.sh)
```

Creates an unprivileged Debian 12 LXC (`nesting=1`), installs Docker, clones this repo, builds the
image, starts the app, and wires up the in-app updater.

Storage is detected automatically — if your host has exactly one container storage it's used, and if
there are several the script lists them (with free space) and asks. Pass `STORAGE=<name>` to skip the
question; `pvesm status --content rootdir` shows the names on your host.

All defaults are overridable:

```bash
CTID=120 STORAGE=local-zfs BRIDGE=vmbr0 NET_IP=192.168.1.50/24 NET_GW=192.168.1.1 \
  bash <(curl -fsSL https://raw.githubusercontent.com/lcsfls/achilles-financials/main/deploy/proxmox-install.sh)
```

### Docker Compose (any host)

```bash
git clone https://github.com/lcsfls/achilles-financials.git
cd achilles-financials
APP_URL=http://<your-lan-ip>:3000 docker compose up -d --build
```

`APP_URL` **must** be the address reachable from your phone — your bank redirects back to it after
authorization. Data lives in the `achilles-data` volume (`/data/achilles.db`); backing up that single
file is a full backup:

```bash
docker run --rm -v achilles-data:/data -v $(pwd):/backup debian \
  tar czf /backup/achilles-backup.tar.gz /data
```

Or use **Settings → Backup** for an encrypted `.achillesbak` you can download and restore from the
browser — no shell needed.

## Connecting your bank

Personal accounts can only be reached through a licensed PSD2 provider — talking to banks directly
would require a qualified eSeal certificate (~€1–2k/year). Achilles uses **Enable Banking**, a
Finnish AISP covering 2,700+ banks in 30 European countries. Their *Restricted Production* tier is
free for personal use: real production data, but only from accounts you whitelist yourself — exactly
what a personal dashboard needs.

1. Create an account at [enablebanking.com](https://enablebanking.com)
2. Register an application in the Control Panel. Set the redirect URL to
   `https://<your-host>/api/bank/callback` (Settings shows the exact URL for your install).
   You'll get an **Application ID** and a **private key** (`.pem`).
3. Paste both into the setup wizard or under **Settings**. They're stored only in your local SQLite.
4. **Connect** → pick country → search your bank → scan the QR code → approve in your banking app → **Sync**

Access is read-only, valid for up to 180 days, and revocable in your banking app at any time.
Prefer not to register at all? Use the **CSV import** on the Connect page.

### Two things production access requires

**HTTPS.** Enable Banking rejects a plain `http://192.168.x.x:3000` redirect URL, so a LAN-only
install can't complete the QR flow as-is. Put a reverse proxy with a real certificate in front —
Nginx Proxy Manager, Caddy, a Cloudflare Tunnel or `tailscale serve` all work. Two things matter:
the certificate must be one your **phone** trusts (a self-signed one means a warning to click
through at best), and the domain has to resolve from the phone.

Then tell Achilles its own address under **Settings → Public address of this instance**
(e.g. `https://achilles.your-domain.com`). Without it the app builds the redirect URL from the
request it happens to see — behind a proxy that's the internal `http://…:3000`, which is exactly
what gets rejected. Settings shows the redirect URL it will actually send, and warns when it isn't
HTTPS. That's the string to register in the Control Panel.

**A privacy policy and terms of service.** Activating a production application requires a link to
each, plus a data protection contact email — and Enable Banking monitors that those links stay
reachable. For a personal instance that means publishing two short pages somewhere public.

Neither applies to the CSV import, which is why it exists.

> **Note:** one bank at a time. Multiple accounts *within* that bank all sync; connecting several
> different banks in parallel isn't supported yet.

## Updating

**In the app:** *Settings → Updates* checks this repo, lists what's new since your version, and
installs it on click. The app writes a request to `control/`, a systemd watcher on the host runs
`deploy/update.sh`, which pulls and rebuilds. Your database is untouched. The Proxmox installer sets
this up automatically.

**In the shell** — one line, inside the LXC/host:

```bash
/opt/achilles-financials/deploy/update.sh
```

Or from the Proxmox host (replace `120` with your CTID):

```bash
pct exec 120 -- /opt/achilles-financials/deploy/update.sh
```

Idempotent: it exits early if you're already on the latest commit, and logs to `control/update.log`.

> In-app updates need `./control` bind-mounted and the systemd watcher installed (the Proxmox
> installer does both). Without it, the app still *checks* for updates and shows you the shell command
> to copy — it just won't run it itself. The app never gets access to the Docker socket.

## Stack

Next.js 15 (App Router, standalone output) · React 19 · Tailwind CSS 4 · shadcn-style UI (Radix)
· Recharts · better-sqlite3 · Docker multi-stage build

Data sources: [Enable Banking](https://enablebanking.com) (PSD2 banking) ·
[gold-api.com](https://gold-api.com) (metal spot prices) · Yahoo Finance (stocks/ETFs/crypto) ·
[frankfurter.app](https://frankfurter.app) (FX rates)

## Disclaimer

A hobby project, built entirely by an AI, for personal use on a private network. It has **no
authentication layer** — don't expose it to the public internet without a reverse proxy with auth
(Authelia, Tailscale, VPN, …) in front of it. Nothing in this app is financial advice.
