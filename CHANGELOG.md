# Changelog

All notable changes to Achilles Financials. Versions follow [semantic versioning](https://semver.org):
the update in Settings tracks released tags, not every commit on `main`.

## [1.0.0] — 2026-07-17

First tagged release.

### Banking
- Connect any of 2,700+ banks across 30 European countries via Enable Banking (PSD2, read-only).
  Pick a country, search your bank, scan a QR code, approve in your banking app.
- CSV import as an alternative that needs no API account. Duplicate-safe, understands German and
  English column headers.
- Rule-based categorization into German/English categories. Manual overrides stick across re-syncs.

### Wealth tracking
- Precious metals: every purchase as its own lot with grams, cost basis and dealer; live spot prices
  for gold, silver, platinum and palladium with P/L per lot and per metal.
- Investments: stocks, ETFs and crypto with live Yahoo Finance prices and USD→EUR conversion.
- Watchlist: its own page with day change and up/down counts.
- Occupational pension: balances from statements, plus the fund allocation the plan holds
  (ETFs with percentage weights) and a contribution start date.

### FIRE
- Multiple saved scenarios, each with its own parameters, progress bar and line in the projection.
- The calculator lives in a modal with a live preview.
- Starting capital is composed from selectable building blocks (liquidity, investments, metals,
  pension) per scenario.

### Emergency fund
- Assign an account and set a target, optionally derived from your actual monthly spending.
  Excluded from FIRE starting capital while still counting toward net worth.

### Operations
- One-command Proxmox install (unprivileged LXC + Docker), with storage detection.
- Updates from Settings or a one-line shell command; the app never touches the Docker socket.
- Everything in one SQLite file. Outbound calls only to public price/FX APIs and your bank.

[1.0.0]: https://github.com/lcsfls/achilles-financials/releases/tag/v1.0.0
