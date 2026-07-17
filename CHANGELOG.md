# Changelog

All notable changes to Achilles Financials. Versions follow [semantic versioning](https://semver.org):
the update in Settings tracks released tags, not every commit on `main`.

## [1.3.0] — 2026-07-17

### Added
- **Screenshots and tutorials in the README.** Eleven 1920×1080 captures of the running app with demo
  data, and seven walkthroughs covering first run, the three ways to get data in, precious metals,
  investments, loans, emergency fund and FIRE, plus a section on FinTS registration and what it does
  and does not require.
- **Demo data now covers loans** — one interest-free loan lent out, one at 3.5 %, and a bank loan
  with fifteen instalments. All dates are relative to today, so the demo does not visibly age.

### Fixed
- A loan with one payment said "1 payments".

## [1.2.1] — 2026-07-17

### Added
- **You decide whether loans count towards net worth** (Settings → Loans in net worth), because there
  is no objectively right answer here — only a stance, and the reasoning sits next to each choice
  rather than buried in a tooltip:
  - **Leave them out** (default) — loans stay on their own page. Money lent out is money someone else
    is holding, and whether it comes back is only known afterwards. The flip side is named too: a
    bank loan raises your net worth for as long as the cash sits in your account.
  - **Subtract debts only** — cautious throughout: what you owe is certain, what you are owed is not.
  - **Include both** — the balance-sheet view: claims count, liabilities are subtracted.

## [1.2.0] — 2026-07-17

### Added
- **Loans** — a new section in the nav. Track money you lent out to someone and money you took on,
  privately or from a bank, with or without interest. Payments are entered by hand; each loan shows
  what is still outstanding, how much of the principal is repaid, the interest so far, and whether it
  is past its due date. Lent-out and taken-on totals are shown separately rather than netted: a claim
  and a debt are different things, and one number for both would say nothing.

#### How the interest is calculated
Stated openly, because a plausible number is not the same as a correct one:

- Interest accrues on the balance **still outstanding**, not on the original sum — repay half and you
  pay interest on half from then on.
- Daily, on **act/365** (actual days ÷ 365), the usual convention for private lending and easy to
  check by hand.
- **Simple interest**: accrued interest is not itself compounded. A private loan with compounding
  would be the exception rather than the rule.
- A payment **covers the accrued interest first**, and the remainder repays the principal — the way a
  bank does it. The other way round would quietly leave interest behind.
- Overpaying does not produce a negative debt; the loan shows nothing outstanding and the surplus is
  named separately.

There is deliberately no fixed instalment schedule: the page records what was actually paid, not what
was supposed to be paid. The maths is covered by 15 tests against hand-computed values.

## [1.1.0] — 2026-07-17

### Added
- **External services page** (Settings → External services). Every connection Achilles makes on its
  own, listed in full: what it is for, **what actually leaves your server**, when it happens, and the
  file in the source where you can check the claim. Six entries — Yahoo Finance, gold-api.com,
  frankfurter.dev, GitHub, Enable Banking and FinTS — each marked as always-on or only-when-used.
  The list was compiled from every outbound `fetch()` in the code, and it lives next to that code
  (`src/lib/services.ts`) rather than in the README, because a page that claims completeness has to
  be maintained where the calls are made.
- **Rearrange watchlist tiles by drag and drop.** Dragging one tile onto another swaps their places.
  Swaps happen within a group only: pinned tiles always sort first, so exchanging a pinned tile with
  an unpinned one would leave the dragged tile where it was and make the other one jump — which would
  read as broken. A new symbol is appended rather than inserted, so it never disturbs an order you
  arranged yourself.

### Fixed
- Floating panels fall back to an opaque background where `backdrop-filter` is unavailable (old
  browsers, disabled GPU acceleration). Without it a translucent panel is not glass but a hole, with
  chart lines running unfiltered through the numbers.

## [1.0.10] — 2026-07-17

### Fixed
- **The update button showed "update complete" and started nothing.** The dialog chose its view from
  the status file alone, and that file outlives every run: after any successful update — including
  one run from the shell — it says `success` forever. Opening the dialog therefore showed the result
  of that earlier run, the confirmation step never appeared, and so the update was never requested.
  A finished state now only counts when the run was started from this dialog; anything else opens on
  the confirmation step. An update that is genuinely in progress is still shown, whoever started it,
  so no second one can be launched alongside it.

## [1.0.9] — 2026-07-17

### Fixed
- **Real glassmorphism on the floating surfaces.** 1.0.6 made them near-opaque so the text would stop
  competing with the chart lines behind it — which covered up the very blur it was meant to carry.
  The right fix was to make `backdrop-filter` work rather than to work around it: chart tooltips now
  portal to the body, so no `transform` sits above them creating a backdrop root with nothing behind
  it. With the whole page behind them, the blur applies, and the base is translucent again
  (45 % over a 28px blur) so it is visible. Chart lines now pass behind the panel as a soft haze
  instead of running through the numbers or disappearing entirely.
- **The chart tooltip could fail to appear.** It only learned the cursor position from a listener
  that started when the tooltip did, so it stayed invisible until the mouse moved again. The
  position is now tracked continuously and is known on the first render.

## [1.0.8] — 2026-07-17

### Added
- **The connect page lists the linked accounts** with balance, entry count, shortened IBAN and last
  sync, instead of only counting them. A number does not tell you whether the right account is
  among them. The list comes from the database rather than another call to the bank.
- **Filter transactions by account.** The selector appears only from two accounts upwards — with one
  it would be a choice without a choice — and offers only accounts that actually have entries.
- **Fetch portfolio holdings over FinTS** (Investments → Fetch portfolio). German banks that support
  the HKWPD transaction return their depot holdings: name, ISIN, units, market price and, where the
  bank sends one, the cost basis. The button only appears when FinTS is configured, and the app asks
  the bank up front whether it supports HKWPD, so an unsupported bank gets a plain explanation
  rather than a raw FinTS error.

### Notes and limits of the portfolio fetch
- **This cannot work for Revolut, and no setting will change that.** PSD2 — and with it Enable
  Banking — covers *payment accounts* only; securities are outside its scope, so stock and crypto
  positions are not exposed. Revolut has no public read API for its trading positions either, and
  FinTS does not reach it. For Revolut, the CSV import remains the way.
- Banks identify securities by **ISIN**, which Yahoo Finance cannot price. Imports merge into an
  existing position by name where possible so the ticker survives; where they do not, the dialog says
  that "Refresh prices" will skip those positions.
- Not every bank sends a cost basis. Where it is missing, the current price stands in as a
  placeholder and performance reads 0 % — the dialog names those positions instead of passing an
  invented cost basis off as real. A cost basis already recorded is never overwritten by a fetch.

### Changed
- The CSV import and the FinTS fetch now share one path into the portfolio (`src/lib/positions.ts`):
  currency conversion, merging and the ticker check are decided in one place rather than drifting
  apart in two.

## [1.0.7] — 2026-07-17

### Added
- **Pin symbols to the top of the watchlist.** The pin sits next to the delete button on each card
  and keeps pinned entries ahead of the rest, so the ones you actually watch stay in the first row.
  The order is decided in the database rather than in the browser, so it is the same on every device,
  and pinned cards keep a gold pin and border once the cursor leaves — otherwise there would be no
  way to tell why a card sits at the front.

### Changed
- **The watchlist uses the full window width.** The 1400px cap is a reading width: right for tables
  and text, wrong for a grid of tiles, which gains from every column that fits. The watchlist now
  opts out of it, and its grid fills the available width by itself (`auto-fill` from a 300px minimum)
  instead of switching between a fixed number of columns at guessed breakpoints. A 1920px screen
  shows five columns where it previously showed three and left the right-hand side empty.

## [1.0.6] — 2026-07-17

### Fixed
- **Chart tooltips and the price hover card were see-through.** They relied on `backdrop-filter`,
  which cannot work there: a `transform` on an ancestor creates a backdrop root, and only what sits
  behind the element *inside that root* gets blurred. Recharts positions its tooltip with exactly
  such a transform on a wrapper that contains nothing but the tooltip — so there was literally
  nothing to blur, the panel stayed transparent and chart lines ran straight through the numbers.
  The transform belongs to Recharts and cannot be removed without losing the positioning.

  Floating surfaces now carry their own near-opaque base (`.glass-float`) instead of depending on an
  effect that is present or absent depending on the ancestor tree. The blur stays on top where it
  does apply. This affected four surfaces, not the two that were visible at first glance: the cash
  flow chart, the pension chart, the FIRE projection and the watchlist hover card.

## [1.0.5] — 2026-07-17

### Fixed
- **The update button disappeared.** The version check asked GitHub for `releases/latest` and took
  that answer unconditionally. A version that is tagged but has no GitHub release published was
  therefore never seen: with 1.0.1 as the newest release, the app reported "up to date" while 1.0.2
  to 1.0.4 already existed as tags. Releases and tags now count equally and the higher version wins.
  Where a version has no release, the settings page says so plainly and links to GitHub instead of
  offering an update with no explanation of what it changes.

### Changed
- **Updates no longer fill the disk.** `docker image prune` only ever removed the replaced image; the
  BuildKit cache — by far the largest item for a Node build, since `npm ci` and the Next.js build add
  layers on every run — was never touched and grew without limit. Updates now prune the build cache
  as well and report the freed space in the log. Set `PRUNE=0` if the Docker host is shared with
  other projects, as pruning affects the whole daemon.
- **Two logs that grew forever are now capped.** The update log is trimmed to its most recent 1 MB
  before each run (it collects the complete build output every time), and the container log is
  limited to 3 × 10 MB — Docker's default is a single file with no limit at all, which quietly grows
  for as long as the dashboard runs.

## [1.0.4] — 2026-07-17

### Fixed
- **The login page flickered and could not be used.** With a login configured, the app shell asked
  `/api/settings` for the setup state from every page — including `/login`, where that endpoint
  correctly answers 401 because nobody is signed in yet. Since 1.0.3 a 401 sent the browser to
  `/login`, which reloaded the page, which asked again: an endless loop that reloaded the form faster
  than anyone could type into it. Two things were wrong and both are fixed — a 401 no longer
  redirects when you are already on the login page, and the shell no longer runs its setup check
  there at all (anyone reaching the login has finished setup anyway).

## [1.0.3] — 2026-07-17

### Added
- **CSV import for portfolios.** Investments → Import CSV reads a broker export, detecting its format
  the same way the bank-statement import does. Two kinds of export are handled:
  a **holdings list** (each row is a position) and an **order list** (each row is a buy or sell) —
  the latter is netted into positions, so several buys of the same security become one holding at its
  weighted average cost, fees included, and partial sells reduce the quantity without distorting that
  average. Re-importing updates the same positions instead of duplicating them, and the dialog shows
  which columns were detected, so an unfamiliar export can be checked rather than trusted.

### Fixed
- **Setting a username and password logged you straight out.** Saving credentials enabled the login
  and rotated the session secret, but never issued a session — so the very next request was rejected
  and the page crashed with "Application error"; a reload appeared to fix it because it sent you to
  the login page. Credentials now come back with a session, and an expired session anywhere in the
  app leads to the login page rather than a crash.

### Notes on the portfolio import
- German exports identify securities by **WKN or ISIN**, while positions here use Yahoo tickers.
  An import falls back to matching by name, so a WKN row merges into an existing `AAPL` position
  rather than double-counting Apple in your net worth. Where no match exists, the WKN or ISIN is
  kept as the symbol and the dialog says plainly that "Refresh prices" cannot use it.
- Foreign-currency amounts are converted at **today's** rate — a broker export contains no historical
  rate. That is right for current prices and wrong for the cost basis of an older purchase, so the
  import says which currencies it converted.

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
