# 🏛️ Achilles Financials

**Self-hosted private wealth dashboard** — connect your Revolut account via QR code, track categorized
spending, precious metals, investments with live prices, your occupational pension, and simulate your
path to financial independence. Wrapped in a dark glassmorphism UI with a gold accent.

> ⚡ **This project is 100 % vibe-coded.** Every line — app, design, deployment scripts, this README —
> was written by an AI coding agent ([Claude Code](https://claude.com/claude-code)) in conversation.
> No human wrote a single line of code. Review it accordingly before trusting it with your finances. 🤖

**Deutsch?** Die App selbst ist zweisprachig — beim ersten Start wählst du im Setup-Assistenten
zwischen Deutsch und Englisch.

---

## Features

| | |
|---|---|
| 🏦 **Revolut via QR code** | Connect through GoCardless Bank Account Data (PSD2, free tier, read-only). Generate a QR code, scan it with your phone, authorize in the Revolut app — Achilles syncs up to 12 months of history. |
| 📄 **CSV import** | No GoCardless account? Export a statement from the Revolut app (Account → Statement → CSV) and upload it. Duplicate-safe, works with German and English exports. |
| 🏷️ **Auto-categorization** | Rule-based categories (groceries, subscriptions, housing, …). Manual overrides are sticky and survive re-syncs. |
| 🥇 **Precious metals** | Track every purchase (lot) of gold, silver, platinum or palladium with grams, cost basis and date. Live spot prices (gold-api.com + ECB FX) show current value and P/L per lot and per metal. |
| 📈 **Investments + live prices** | Stocks, ETFs, crypto — add a Yahoo-format symbol (`AAPL`, `VWCE.DE`, `BTC-EUR`) and refresh all prices with one click, including USD→EUR conversion. |
| 👀 **Watchlist** | Watch any symbol with price and daily change. |
| 🔥 **FIRE simulator** | Inflation-adjusted wealth projection, FIRE number, years to financial independence — interactive sliders, seeded from your real net worth. |
| 🐷 **Occupational pension** | Log the balances from your pension statements; the latest balance feeds into net worth and the FIRE simulation. |
| 🌍 **Bilingual** | German and English, chosen in the first-run setup wizard, switchable anytime. |
| ⬆️ **Self-updating** | Settings → Updates shows the changelog since your version and installs it with one click (pulls this repo and rebuilds). Or one line in the shell. |
| 🔒 **Private by design** | Everything lives in a single SQLite file on your server. The only outbound calls are public price/FX APIs — no personal data ever leaves your box. |

## Screenshots

Dark glassmorphism UI, gold accents, animated charts — run the demo mode and see for yourself:
the setup wizard offers realistic sample data on first launch.

## Quick start (local)

```bash
git clone https://github.com/lcsfls/achilles-financials.git
cd achilles-financials
npm install
npm run dev        # → http://localhost:3000
```

The first-run setup wizard walks you through language, the optional Revolut connection and demo data.

## Deployment

### Proxmox (recommended) — one command

Run on your Proxmox VE host as root:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/lcsfls/achilles-financials/main/deploy/proxmox-install.sh)
```

The script creates an unprivileged Debian 12 LXC (with `nesting=1`), installs Docker, clones this
repo, builds the image and starts the app.

Storage is detected automatically — if your host has exactly one container storage it's used, and if
there are several the script lists them (with free space) and asks. Pass `STORAGE=<name>` to skip the
question; run `pvesm status --content rootdir` to see the names on your host.

All defaults are overridable via environment variables:

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

`APP_URL` **must** be the address reachable from your phone — Revolut redirects back to it after
authorization. Data lives in the `achilles-data` volume (`/data/achilles.db`); backing up that one
file is a full backup:

```bash
docker run --rm -v achilles-data:/data -v $(pwd):/backup debian \
  tar czf /backup/achilles-backup.tar.gz /data
```

## Updating

**In the app:** *Settings → Updates* checks this repo, lists what's new since your version, and
installs it on click. The app writes a request to `control/`, a systemd watcher on the host runs
`deploy/update.sh`, which pulls and rebuilds. Your database is untouched. The Proxmox installer sets
this up automatically.

**In the shell** — one line, from inside the LXC/host:

```bash
/opt/achilles-financials/deploy/update.sh
```

Or straight from the Proxmox host (replace `120` with your CTID):

```bash
pct exec 120 -- /opt/achilles-financials/deploy/update.sh
```

The script is idempotent: it exits early if you're already on the latest commit, and writes its log
to `control/update.log`.

> **Note on in-app updates:** they only work when `./control` is bind-mounted and the systemd watcher
> is installed (the Proxmox installer does both). Without it, the app still *checks* for updates and
> shows you the shell command to copy — it just won't run it itself. The app never gets access to the
> Docker socket.

## Connecting Revolut

Personal Revolut accounts can only be accessed through a licensed PSD2 provider — that's what
GoCardless Bank Account Data is (FCA-regulated, free tier, read-only, revocable in the Revolut app
at any time).

1. Create a free account at [bankaccountdata.gocardless.com](https://bankaccountdata.gocardless.com)
2. Create a secret pair under **Developers → User Secrets**
3. Paste it in the setup wizard or under **Settings**
4. **Connect** → generate the QR code → scan with your phone → approve in the Revolut app → **Sync**

Don't want a GoCardless account? Use the **CSV import** on the Connect page instead.

## Stack

Next.js 15 (App Router, standalone output) · React 19 · Tailwind CSS 4 · shadcn-style UI (Radix)
· Recharts · better-sqlite3 · Docker multi-stage build

Price data: [gold-api.com](https://gold-api.com) (metals) · Yahoo Finance (stocks/ETFs/crypto)
· [frankfurter.app](https://frankfurter.app) (FX)

## Disclaimer

This is a hobby project, built entirely by an AI, for personal use on a private network.
It has no authentication layer — do not expose it to the public internet without putting a
reverse proxy with auth (Authelia, Tailscale, VPN, …) in front of it.
Nothing in this app is financial advice.
