# Changelog

All notable changes to Achilles Financials. Versions follow [semantic versioning](https://semver.org):
the update in Settings tracks released tags, not every commit on `main`.

## [1.0.1] — 2026-07-17

### Added
- **Login.** Username and password (scrypt via `node:crypto`), enforced in middleware so no route can
  be forgotten. Sessions are signed HMAC tokens in an httpOnly cookie; changing the password
  invalidates them. Off until you configure it, so a fresh install can't lock you out.
  Passkeys are not implemented yet.
- **Encrypted backup.** Settings → Backup downloads a password-protected `.achillesbak`
  (AES-256-GCM, key derived with scrypt), and restores from one. The file holds your banking private
  key and every transaction, so it is never written in the clear — and never restorable without the
  password.
- **Public address setting.** Behind a reverse proxy the app can now be told its own HTTPS domain.
  Settings shows the redirect URL it will actually send to Enable Banking and warns when it isn't
  HTTPS.
- **Emergency fund** works without an account — reserves the app can't see (savings at another bank,
  cash) can be entered manually — and has its own page and nav entry.
- **Container password.** The Proxmox installer now generates a root password, sets it, and prints it
  once at the end. Previously `pct create` ran without `--password`, so the container had none at all.

### Fixed
- **Restoring a backup no longer breaks the app.** Swapping the database file invalidated every
  SQLite connection except the restoring route's own — Next.js bundles routes separately, so each
  holds its own. Restore now replaces the contents inside the live connection via `ATTACH`, copying
  only columns present in both schemas so older backups still restore.
- **The permissions hint said "fix it on the host"**, which read as "log into the container" — a
  container that has no password to log in with. It now shows the `pct exec` form and states that no
  container password is needed.

### Documentation
- Enable Banking production access requires an **HTTPS redirect URL** (a LAN-only install cannot
  complete the QR flow) and **published privacy policy and terms pages** plus a data protection
  email, which Enable Banking monitors for availability. Neither applies to the CSV import.

[1.0.1]: https://github.com/lcsfls/achilles-financials/releases/tag/v1.0.1

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
