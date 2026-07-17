# Changelog

All notable changes to Achilles Financials. Versions follow [semantic versioning](https://semver.org):
the update in Settings tracks released tags, not every commit on `main`.

## [1.0.2] — 2026-07-17

### Added
- **Display currency.** Settings → Currency switches the whole dashboard to one of twelve currencies
  (EUR, USD, CHF, GBP, SEK, NOK, DKK, PLN, CZK, CAD, AUD, JPY), and **USD is always shown as a second
  value** next to net worth and the KPI tiles — unless USD is already the main currency, where a
  duplicate would be pointless. Amounts are still stored in euros; conversion happens only at display
  time, using ECB reference rates (frankfurter.dev, daily). Input fields for prices and balances
  therefore stay in euros.
- **Flexible CSV import.** Bank exports have no common format, so nothing is assumed any more — the
  delimiter (`;`, `,`, tab, `|`), the header row (preambles are skipped), and the column meanings are
  all detected from the file. Handles German and English number formats (`1.234,56` / `1,234.56`),
  trailing and parenthesised minus signs, ISO / `DD.MM.YYYY` / two-digit dates, separate debit and
  credit columns, and separate sign columns (`S`/`H`). The response reports which columns it mapped,
  so an unfamiliar export can be checked rather than trusted. Tested against Revolut, Sparkasse,
  debit/credit and tab-delimited layouts.

### Fixed
- **Column detection picked the wrong column.** The leftmost match won instead of the most specific
  one, so Revolut imports dated transactions by "Started Date" rather than "Completed Date", and
  Sparkasse ones showed "Buchungstext" instead of the actual "Verwendungszweck".
- **Watchlist hid the converted price** when a quote was already quoted in euros — with a different
  display currency that meant the converted value was missing exactly where it was needed.
- **The precious-metals table claimed "€/g"** in a column that follows the display currency. The cell
  prints its own currency symbol, so the header no longer names one.
- **FX rates moved.** `frankfurter.app` now answers with a 301 to `api.frankfurter.dev/v1`. Requests
  still worked (redirects are followed), but all calls now go to the current endpoint directly.

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
