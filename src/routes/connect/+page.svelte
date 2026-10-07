<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { QrCode, RefreshCw, CheckCircle2, AlertTriangle, Smartphone, Link2, FileUp, Search, Building2, Info } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { COUNTRIES, countryName } from "$lib/countries";
  import { apiJson, cn, fmtDateTime, fmtEUR } from "$lib/utils";

  type Status = {
    hasCreds: boolean; status: string | null; accounts: number;
    list?: Array<{ id: string; provider: string; name: string | null; iban: string | null; currency: string | null; balance: number; last_synced: string | null; txCount: number }>;
    aspsp: string | null; country: string; lastSync: string | null; linkedAt: string | null; error?: string;
  };
  type Aspsp = { name: string; country: string; logo?: string; beta?: boolean };

  /**
   * Banks listed under the country of their licence, not of their IBAN.
   * Revolut is the prominent case: German IBAN, but the bank is the Lithuanian
   * Revolut Bank UAB, Germany only a branch.
   */
  const LICENSED_ELSEWHERE: Array<{ match: RegExp; country: string }> = [
    { match: /revolut/i, country: "LT" },
    { match: /\bn26\b/i, country: "DE" },
    { match: /wise/i, country: "BE" },
    { match: /bunq/i, country: "NL" },
  ];

  let status = $state<Status | null>(null);
  let qr = $state<{ link: string; qrDataUrl: string } | null>(null);
  let busy = $state<string | null>(null);
  let message = $state<{ kind: "ok" | "err"; text: string } | null>(null);
  let country = $state("DE");
  let aspsps = $state<Aspsp[] | null>(null);
  let isSandbox = $state(false);
  let aspspQuery = $state("");
  let selected = $state<string | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();

  const loadStatus = () =>
    apiJson<Status>("/api/bank/status").then((s) => {
      status = s;
      if (s.country) country = s.country;
    });

  onMount(() => {
    const linkedParam = page.url.searchParams.get("linked") === "1";
    const error = page.url.searchParams.get("error");
    if (linkedParam) message = { kind: "ok", text: t("Bank verbunden! Starte jetzt die erste Synchronisierung.") };
    else if (error) message = { kind: "err", text: error };
    loadStatus();
  });

  async function loadAspsps(c: string) {
    busy = "aspsps";
    aspsps = null;
    message = null;
    const res = await fetch(`/api/bank/aspsps?country=${c}`);
    const data = await res.json();
    busy = null;
    if (!res.ok) { message = { kind: "err", text: data.error }; return; }
    aspsps = data.aspsps;
    isSandbox = Boolean(data.sandbox);
  }

  async function createQr(aspspName: string) {
    busy = "qr";
    message = null;
    selected = aspspName;
    const res = await fetch("/api/bank/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aspspName, country }),
    });
    const data = await res.json();
    busy = null;
    if (!res.ok) { message = { kind: "err", text: data.error }; selected = null; return; }
    qr = data;
  }

  async function importCsv(file: File) {
    busy = "csv";
    message = null;
    const csv = await file.text();
    const res = await fetch("/api/import/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = await res.json();
    busy = null;
    if (!res.ok) { message = { kind: "err", text: data.error }; return; }
    message = { kind: "ok", text: t("CSV importiert: {n} Transaktionen ({s} übersprungen).", { n: data.imported, s: data.skipped }) };
  }

  async function sync() {
    busy = "sync";
    message = null;
    const res = await fetch("/api/bank/sync", { method: "POST" });
    const data = await res.json();
    busy = null;
    if (!res.ok) { message = { kind: "err", text: data.error }; return; }
    message = { kind: "ok", text: t("Synchronisiert: {a} Konten, {n} Transaktionen.", { a: data.accounts, n: data.transactions }) };
    loadStatus();
  }

  const linked = $derived(Boolean(status?.linkedAt) && status?.status !== "EXPIRED");
  const filtered = $derived((aspsps ?? []).filter((a) => a.name.toLowerCase().includes(aspspQuery.toLowerCase())));
  const noCreds = $derived(status !== null && !status.hasCreds);

  // Cap what is rendered so a thousand banks don't slow the browser — but never
  // silently: how many are hidden is stated below.
  const VISIBLE = 60;
  const shown = $derived(filtered.slice(0, VISIBLE));
  const hidden = $derived(filtered.length - shown.length);

  // Searched bank licensed in another country? Point there instead of letting
  // the user search an empty list.
  const elsewhere = $derived(
    aspspQuery.trim().length >= 3 && filtered.length === 0
      ? LICENSED_ELSEWHERE.find((e) => e.match.test(aspspQuery) && e.country !== country)
      : undefined
  );
</script>

<svelte:head><title>{t("Bank verbinden")} · Achilles</title></svelte:head>

<input
  bind:this={fileInput}
  type="file"
  accept=".csv,text/csv"
  class="hidden"
  onchange={(e) => { const el = e.currentTarget; const f = el.files?.[0]; if (f) importCsv(f); el.value = ""; }}
/>

<div class="rise space-y-6">
  <PageHeader
    title={t("Bank verbinden")}
    subtitle={t("Über die PSD2-Schnittstelle von Enable Banking — 2.700+ Banken in 30 europäischen Ländern. Du autorisierst den Zugriff direkt in deiner Banking-App. Achilles bekommt nur Lesezugriff auf Salden und Umsätze, niemals Zugriff auf Zahlungen.")}
  />

  {#if message}
    <Alert tone={message.kind === "ok" ? "pos" : "neg"}>{message.text}</Alert>
  {/if}

  {#if noCreds}
    <Alert tone="warn">
      <span class="font-medium text-ink">{t("Enable-Banking-Zugangsdaten fehlen.")}</span>
      {t("Lege einen Account auf enablebanking.com an, registriere im Control Panel eine Anwendung und hinterlege Application-ID und Private Key in den")}
      <a href="/settings" class="font-medium text-accent underline underline-offset-2">{t("Einstellungen")}</a>.
    </Alert>
  {/if}

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
    <Card>
      <CardHeader title={qr ? t("QR-Code · Smartphone") : t("Bank wählen")}>
        {#snippet actions()}
          {#if linked && status?.aspsp}<Badge tone="pos">{status.aspsp}</Badge>{/if}
        {/snippet}
      </CardHeader>
      <div class="flex flex-col items-center gap-5 px-5 pb-6">
        {#if qr}
          <div class="rounded-3xl border border-line bg-white p-4 shadow-[var(--shadow-pop)]">
            <img src={qr.qrDataUrl} alt={t("QR-Code")} width="260" height="260" class="rounded-xl" />
          </div>
          <div class="text-center text-xs leading-relaxed text-muted">
            {#if selected}<div class="mb-1 text-sm font-semibold text-ink">{selected}</div>{/if}
            {t("Mit der Smartphone-Kamera scannen — der Link öffnet die Autorisierung, deine Banking-App übernimmt automatisch.")}
          </div>
          <div class="flex flex-col items-center gap-2">
            <a href={qr.link} target="_blank" rel="noreferrer" class="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              <Link2 class="size-3.5" /> {t("Oder Link direkt auf diesem Gerät öffnen")}
            </a>
            <button type="button" onclick={() => { qr = null; selected = null; }} class="cursor-pointer text-xs text-muted hover:text-ink">{t("Andere Bank wählen")}</button>
          </div>
        {:else}
          <div class="w-full space-y-4">
            <Field label={t("Land")}>
              <Select
                bind:value={country}
                onchange={() => { aspsps = null; aspspQuery = ""; }}
                disabled={noCreds}
                options={COUNTRIES.map((c) => ({ value: c.code, label: prefs.lang === "de" ? c.de : c.en }))}
              />
            </Field>

            {#if aspsps === null}
              <div class="flex h-[180px] items-center justify-center rounded-2xl bg-surface-2">
                <QrCode class="size-16 text-line-strong" strokeWidth={1} />
              </div>
              <Button class="w-full" disabled={busy === "aspsps" || noCreds} onclick={() => loadAspsps(country)}>
                <Building2 /> {busy === "aspsps" ? t("Lade Banken …") : t("Banken anzeigen")}
              </Button>
            {:else}
              <div class="relative">
                <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                <Input class="pl-9" placeholder={t("{n} Banken durchsuchen …", { n: aspsps.length })} bind:value={aspspQuery} />
              </div>
              {#if isSandbox}
                <Alert tone="warn">{t("Diese Liste kommt aus der Sandbox-Umgebung — echte Banken wie Revolut fehlen dort. Registriere im Control Panel eine Anwendung in der Produktionsumgebung (Sandbox-Apps lassen sich nicht umstellen).")}</Alert>
              {/if}

              <div class="max-h-[300px] space-y-0.5 overflow-y-auto">
                {#if filtered.length === 0 && !elsewhere}
                  <div class="py-6 text-center text-xs text-muted">{t("Keine Bank gefunden.")}</div>
                {/if}
                {#if elsewhere}
                  <button
                    type="button"
                    onclick={() => { if (elsewhere) { country = elsewhere.country; aspsps = null; } }}
                    class="flex w-full cursor-pointer items-start gap-2 rounded-xl bg-accent-soft px-3 py-3 text-left text-xs leading-relaxed text-accent"
                  >
                    <Info class="mt-0.5 size-3.5 shrink-0" />
                    <span>{t("Diese Bank ist in {country} lizenziert und dort gelistet — auch wenn deine IBAN aus einem anderen Land stammt. Zum Wechseln hier klicken.", { country: countryName(elsewhere.country, prefs.lang) })}</span>
                  </button>
                {/if}
                {#each shown as a (`${a.country}-${a.name}`)}
                  <button
                    type="button"
                    onclick={() => createQr(a.name)}
                    disabled={busy === "qr"}
                    class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-3 disabled:opacity-50"
                  >
                    {#if a.logo}
                      <img src={a.logo} alt="" class="size-7 shrink-0 rounded-md bg-white object-contain p-0.5" />
                    {:else}
                      <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-3"><Building2 class="size-4 text-muted" /></span>
                    {/if}
                    <span class="min-w-0 flex-1 truncate">{a.name}</span>
                    {#if a.beta}<span class="shrink-0 text-[10px] text-faint">beta</span>{/if}
                  </button>
                {/each}
              </div>
              {#if hidden > 0}
                <div class="text-center text-[11px] text-muted">{t("{n} weitere ausgeblendet — tippe oben, um zu suchen.", { n: hidden })}</div>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    </Card>

    <div class="space-y-5">
      <Card class="p-5">
        <ol class="space-y-5">
          {#each [
            { icon: Building2, title: t("1 · Bank wählen"), text: t("Land auswählen und deine Bank aus der Liste anklicken.") },
            { icon: Smartphone, title: t("2 · Mit dem Smartphone scannen"), text: t("In deiner Banking-App bestätigst du den Lesezugriff auf Salden und Transaktionen.") },
            { icon: RefreshCw, title: t("3 · Synchronisieren"), text: t("Achilles lädt bis zu 12 Monate Umsatzhistorie und kategorisiert alles automatisch.") },
          ] as step (step.title)}
            <li class="flex gap-4">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><step.icon class="size-4.5" /></span>
              <div>
                <div class="text-sm font-semibold">{step.title}</div>
                <div class="mt-0.5 text-xs leading-relaxed text-muted">{step.text}</div>
              </div>
            </li>
          {/each}
        </ol>
      </Card>

      <Card class="p-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-semibold">{t("Synchronisierung")}</div>
            <div class="mt-0.5 text-xs text-muted">
              {status?.accounts ? t("{n} Konten verknüpft", { n: status.accounts }) : t("Noch keine Konten verknüpft")}{status?.lastSync ? ` · ${t("zuletzt {date}", { date: fmtDateTime(status.lastSync) })}` : ""}
            </div>
          </div>
          <Button variant="secondary" onclick={sync} disabled={busy === "sync" || !linked}>
            <RefreshCw class={busy === "sync" ? "animate-spin" : ""} /> {busy === "sync" ? t("Läuft …") : t("Jetzt syncen")}
          </Button>
        </div>

        <!-- List the linked accounts one by one — a count alone doesn't say whether the right one is there. -->
        {#if status?.list && status.list.length > 0}
          <div class="mt-4 divide-y divide-line rounded-xl border border-line">
            {#each status.list as a (a.id)}
              <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium">{a.name || a.iban || a.id}</div>
                  <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                    <!-- IBAN shortened: the last digits are enough to recognise it. -->
                    {#if a.iban}<span class="num">···{a.iban.slice(-6)}</span>{/if}
                    <span>{t("{n} Buchungen", { n: a.txCount })}</span>
                    {#if a.last_synced}<span>· {fmtDateTime(a.last_synced)}</span>{/if}
                  </div>
                </div>
                <div class="num shrink-0 text-sm font-semibold">{fmtEUR(a.balance)}</div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <Card class="p-5">
        <div class="flex items-start gap-4">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info"><FileUp class="size-4.5" /></span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold">{t("Alternative: CSV-Import")}</div>
            <p class="mt-0.5 text-xs leading-relaxed text-muted">
              {t("Ohne Bankanbindung: Kontoauszug als CSV aus deiner Banking-App exportieren und hier hochladen. Duplikate werden automatisch erkannt, manuelle Kategorien bleiben erhalten.")}
            </p>
            <Button variant="secondary" size="sm" class="mt-3" disabled={busy === "csv"} onclick={() => fileInput?.click()}>
              <FileUp /> {busy === "csv" ? t("Importiere …") : t("CSV-Datei auswählen")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</div>
