<script lang="ts">
  import { onMount } from "svelte";
  import type { Component } from "svelte";
  import {
    Database, Sparkles, CheckCircle2, Languages, RefreshCw, Download, GitBranch, Terminal, Lock, LogOut, Archive, Upload,
    Coins, ShieldCheck, HandCoins, Home, Timer, Briefcase, Palette, PlugZap, Sun, Moon, Monitor,
  } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import UpdateDialog from "$lib/components/UpdateDialog.svelte";
  import IntegrationsSection from "$lib/components/IntegrationsSection.svelte";
  import { t } from "$lib/i18n";
  import { prefs, setLang, setCurrency, setTheme, type Lang, type Theme } from "$lib/prefs.svelte";
  import { CURRENCIES } from "$lib/currency";
  import { SERVICES } from "$lib/services";
  import { apiJson, cn, fmtDateTime } from "$lib/utils";

  type Settings = {
    businessInNetWorth: "low" | "mid" | "exclude"; syncInterval: "manual" | "6h" | "12h" | "24h" | "7d";
    syncLastAuto: string | null; syncNextRun: string | null; propertyInNetWorth: "include" | "exclude";
    loansInNetWorth: "none" | "borrowed" | "both"; ebConfigured: boolean; ebAppIdMasked: string | null; country: string;
    demoMode: boolean; language: string; authEnabled: boolean; authUser: string | null; appUrl: string;
    appUrlSource: "setting" | "env" | "request"; effectiveOrigin: string; callbackUrl: string;
  };

  type UpdateInfo = {
    repo: string;
    branch: string;
    version: { version: string | null; sha: string | null; shortSha: string | null; deployedAt: string | null; branch: string };
    status: { state: "idle" | "requested" | "running" | "success" | "error"; message?: string; finishedAt?: string; toSha?: string };
    log: string | null;
    canUpdate: boolean;
    control: "ok" | "missing" | "readonly";
    fixCommand: string | null;
    latest: { version: string; tag: string; notes: string | null; publishedAt: string | null } | null;
    updateAvailable: boolean | null;
    checkFailed: boolean;
    upToDate: boolean;
    releasesUrl: string;
    shellCommand: string | null;
    installMethod?: "docker" | "deb" | "desktop";
  };

  let settings = $state<Settings | null>(null);
  let busy = $state(false);
  let upd = $state<UpdateInfo | null>(null);
  let updDialog = $state(false);
  let copied = $state(false);
  let demoWarning = $state(false);
  let authUser = $state("");
  let authPass = $state("");
  let authCurrent = $state("");
  let authError = $state<string | null>(null);
  let authSaved = $state(false);
  let bakPass = $state("");
  let bakBusy = $state<string | null>(null);
  let bakError = $state<string | null>(null);
  let bakInfo = $state<string | null>(null);
  let restoreFile = $state<File | null>(null);
  let restoreInput: HTMLInputElement | undefined = $state();
  let demoCounts = $state<{ accounts: number; netWorth: number } | null>(null);
  let servicesOpen = $state(false);

  const load = () => apiJson<Settings>("/api/settings").then((s) => (settings = s));
  const loadUpdate = (refresh = false) =>
    apiJson<UpdateInfo>(`/api/update${refresh ? "?refresh=1" : ""}`).then((u) => (upd = u)).catch(() => {});
  onMount(() => { load(); loadUpdate(); });

  // While an update runs, poll the status — the container restarts meanwhile,
  // so failed requests are expected.
  const running = $derived(upd?.status.state === "requested" || upd?.status.state === "running");
  $effect(() => {
    if (!running) return;
    const iv = setInterval(() => loadUpdate(), 4000);
    return () => clearInterval(iv);
  });

  async function post(body: Record<string, unknown>) {
    return fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  async function saveAuth(disable = false) {
    busy = true;
    authError = null;
    const res = await post({
      auth: disable ? { disable: true, currentPassword: authCurrent } : { username: authUser, password: authPass, currentPassword: authCurrent },
    });
    busy = false;
    if (!res.ok) { authError = t((await res.json()).error); return; }
    authPass = "";
    authCurrent = "";
    authSaved = true;
    setTimeout(() => (authSaved = false), 3000);
    load();
  }

  // Switch at once, then save — the choice shouldn't wait for the server.
  async function saveChoice(field: "loansInNetWorth" | "propertyInNetWorth" | "businessInNetWorth" | "syncInterval", key: string, v: string) {
    if (settings) (settings as Record<string, unknown>)[field] = v;
    await post({ [key]: v });
    if (field === "syncInterval") load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function downloadBackup() {
    bakBusy = "backup";
    bakError = null;
    bakInfo = null;
    const res = await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: bakPass }),
    });
    if (!res.ok) { bakBusy = null; bakError = t((await res.json()).error); return; }
    const blob = await res.blob();
    const name = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "achilles.achillesbak";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    bakBusy = null;
    bakInfo = t("Backup heruntergeladen: {name}", { name });
  }

  async function doRestore() {
    if (!restoreFile) return;
    if (!confirm(t("Wiederherstellen? Alle aktuellen Daten werden durch den Inhalt des Backups ersetzt — auch Login und Bank-Zugangsdaten."))) return;
    bakBusy = "restore";
    bakError = null;
    bakInfo = null;
    const form = new FormData();
    form.append("file", restoreFile);
    form.append("password", bakPass);
    const res = await fetch("/api/backup/restore", { method: "POST", body: form });
    bakBusy = null;
    if (!res.ok) { bakError = t((await res.json()).error); return; }
    const d = await res.json();
    bakInfo = t("Wiederhergestellt: {n} Tabellen. Seite wird neu geladen …", { n: d.tables });
    setTimeout(() => window.location.reload(), 1500);
  }

  async function toggleDemo(on: boolean) {
    busy = true;
    await fetch("/api/demo", { method: on ? "POST" : "DELETE" });
    busy = false;
    demoWarning = false;
    load();
  }

  // Look at what is already there before warning — a concrete number weighs
  // more than a general warning.
  async function openDemoWarning() {
    demoCounts = null;
    demoWarning = true;
    const s = await apiJson<{ accounts: { id: string }[]; netWorth: number }>("/api/summary").catch(() => null);
    if (s) demoCounts = { accounts: (s.accounts ?? []).filter((a) => a.id !== "demo-main").length, netWorth: s.netWorth ?? 0 };
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  const SECTIONS = $derived([
    { id: "general", label: t("Allgemein") },
    { id: "networth", label: t("Gesamtvermögen") },
    { id: "banks", label: t("Bankanbindungen") },
    { id: "security", label: t("Login") },
    { id: "data", label: t("Daten & Backup") },
    { id: "updates", label: t("Updates") },
  ]);

  const THEMES = $derived<Array<{ value: Theme; label: string; icon: typeof Sun }>>([
    { value: "light", label: t("Hell"), icon: Sun },
    { value: "dark", label: t("Dunkel"), icon: Moon },
    { value: "system", label: t("System"), icon: Monitor },
  ]);

  const pill = (on: boolean) =>
    cn(
      "cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
      on ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2 hover:border-line-strong"
    );
</script>

{#snippet section(id: string, Icon: Component<{ class?: string }>, title: string, subtitle: string, body: () => ReturnType<import("svelte").Snippet>, badge?: () => ReturnType<import("svelte").Snippet>)}
  <Card class="scroll-mt-6" id={id}>
    <div class="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div class="flex items-center gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-ink-2"><Icon class="size-4.5" /></span>
        <div>
          <h3 class="text-[15px] font-semibold">{title}</h3>
          <div class="text-xs text-muted">{subtitle}</div>
        </div>
      </div>
      {#if badge}{@render badge()}{/if}
    </div>
    <div class="space-y-4 px-5 pb-5">{@render body()}</div>
  </Card>
{/snippet}

{#snippet choices(current: string | undefined, items: ReadonlyArray<readonly [string, string, string]>, onpick: (v: string) => void)}
  <div class="space-y-2">
    {#each items as [v, label, why] (v)}
      <button
        type="button"
        onclick={() => onpick(v)}
        class={cn(
          "flex w-full cursor-pointer gap-3 rounded-xl border p-3.5 text-left transition-all",
          current === v ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"
        )}
      >
        <span class={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2", current === v ? "border-accent" : "border-line-strong")}>
          {#if current === v}<span class="size-1.5 rounded-full bg-accent"></span>{/if}
        </span>
        <span>
          <span class="block text-sm font-semibold">{label}</span>
          <span class="mt-0.5 block text-xs leading-relaxed text-muted">{why}</span>
        </span>
      </button>
    {/each}
  </div>
{/snippet}

{#snippet codeLine(text: string)}
  <div class="flex items-center gap-2">
    <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-surface-3 px-3 py-2 font-mono text-[11px] text-ink">{text}</code>
    <Button variant="secondary" size="sm" onclick={() => copy(text)}>{copied ? t("Kopiert") : t("Kopieren")}</Button>
  </div>
{/snippet}

<svelte:head><title>{t("Einstellungen")} · Achilles</title></svelte:head>

<div class="rise">
  <PageHeader title={t("Einstellungen")} subtitle={t("API-Zugänge, Sprache und Daten verwalten.")} />

  <div class="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
    <!-- Section nav -->
    <nav class="hidden lg:block">
      <div class="sticky top-9 space-y-0.5">
        {#each SECTIONS as s (s.id)}
          <a href="#{s.id}" class="block rounded-lg px-3 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink">{s.label}</a>
        {/each}
      </div>
    </nav>

    <div class="min-w-0 space-y-8">
      <!-- General -->
      <section id="general" class="scroll-mt-6 grid items-start gap-4 2xl:grid-cols-2">
        <h2 class="col-span-full text-xs font-semibold uppercase tracking-wider text-faint">{t("Allgemein")}</h2>

        {#snippet langBody()}
          <div class="grid grid-cols-2 gap-2">
            {#each [["de", "Deutsch"], ["en", "English"]] as [code, label] (code)}
              <button type="button" onclick={() => setLang(code as Lang)} class={pill(prefs.lang === code)}>{label}</button>
            {/each}
          </div>
        {/snippet}
        {@render section("lang", Languages, t("Sprache"), t("Sprache der Oberfläche und Zahlenformate"), langBody)}

        {#snippet themeBody()}
          <div class="grid grid-cols-3 gap-2">
            {#each THEMES as th (th.value)}
              <button type="button" onclick={() => setTheme(th.value)} class={cn(pill(prefs.theme === th.value), "flex items-center justify-center gap-2")}>
                <th.icon class="size-4" /> {th.label}
              </button>
            {/each}
          </div>
          <p class="text-xs text-muted">{t("Gilt nur für dieses Gerät — so kann das Handy dunkel bleiben, während der Desktop hell ist.")}</p>
        {/snippet}
        {@render section("theme", Palette, t("Darstellung"), t("Helles oder dunkles Design"), themeBody)}

        {#snippet currencyBody()}
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {#each CURRENCIES as c (c.code)}
              <button type="button" onclick={() => setCurrency(c.code)} title={prefs.lang === "en" ? c.en : c.de} class={pill(prefs.currency === c.code)}>
                <span class="num">{c.code}</span><span class="ml-1.5 text-xs opacity-60">{c.symbol}</span>
              </button>
            {/each}
          </div>
          <p class="text-xs leading-relaxed text-muted">{t("Gespeichert wird weiterhin in Euro — umgerechnet wird erst bei der Anzeige, mit EZB-Referenzkursen (frankfurter.dev, täglich). Eingabefelder für Kaufpreise und Beträge bleiben deshalb in Euro.")}</p>
        {/snippet}
        {@render section("currency", Coins, t("Währung"), t("Anzeigewährung · USD wird immer zusätzlich gezeigt"), currencyBody)}
      </section>

      <!-- Net worth -->
      <section id="networth" class="scroll-mt-6 grid items-start gap-4 2xl:grid-cols-2">
        <h2 class="col-span-full text-xs font-semibold uppercase tracking-wider text-faint">{t("Gesamtvermögen")}</h2>

        {#snippet loansBody()}
          <!-- Reasons next to the options: the choice is a stance, not a setting — explained where it is made. -->
          {@render choices(settings?.loansInNetWorth, [
            ["none", t("Nicht einbeziehen"), t("Kredite bleiben eine eigene Seite. Verliehenes ist Geld, das ein anderer gerade hat — ob es zurückkommt, weiß man erst hinterher. Aber Vorsicht: Ein Bankkredit erhöht dein Vermögen, solange das Geld noch auf dem Konto liegt.")],
            ["borrowed", t("Nur Schulden abziehen"), t("Durchgehend vorsichtig: Was du schuldest, zählt sicher — was du bekommen sollst, vielleicht. Aufgenommene Kredite werden abgezogen, Verliehenes bleibt draußen.")],
            ["both", t("Beides einbeziehen"), t("Die bilanzielle Sicht: Forderungen zählen, Verbindlichkeiten werden abgezogen. Vermögen minus Schulden — so würde eine Bilanz es sehen.")],
          ], (v) => saveChoice("loansInNetWorth", "loans_in_networth", v))}
        {/snippet}
        {@render section("loans", HandCoins, t("Kredite im Gesamtvermögen"), t("Ob Verliehenes und Aufgenommenes mitzählen"), loansBody)}

        {#snippet propertyBody()}
          {@render choices(settings?.propertyInNetWorth, [
            ["include", t("Mitzählen"), t("Eine Immobilie, die dir gehört, ist ein Vermögenswert — anders als verliehenes Geld hältst du sie selbst. Beachte: Eine Hypothek darauf führst du unter Kredite; ob sie abgezogen wird, entscheidet die Einstellung dort.")],
            ["exclude", t("Nicht mitzählen"), t("Immobilien bleiben eine eigene Seite. Sinnvoll, wenn dein Wert eine grobe Schätzung ist und du das Gesamtvermögen nicht darauf stützen willst — eine Immobilie ist zudem nicht kurzfristig zu Geld zu machen.")],
          ], (v) => saveChoice("propertyInNetWorth", "property_in_networth", v))}
        {/snippet}
        {@render section("property", Home, t("Immobilien im Gesamtvermögen"), t("Ob erfasste Objekte mitzählen"), propertyBody)}

        {#snippet businessBody()}
          {@render choices(settings?.businessInNetWorth, [
            ["low", t("Unterer Wert (Empfehlung)"), t("Der Rechner liefert eine Bandbreite, keinen Punktwert. Das untere Ende ist die vorsichtige Wahl — ein Unternehmen ist das mit Abstand illiquideste hier, und ein zu hoch angesetzter Wert schönt jede Kennzahl, die darauf aufbaut.")],
            ["mid", t("Mittelwert"), t("Die Mitte der Bandbreite. Näher an dem, was ein Verkauf realistisch bringen könnte — aber eben auch nur eine Schätzung, deren Spanne von 1× bis 7× EBITDA reicht.")],
            ["exclude", t("Nicht mitzählen"), t("Bewertungen bleiben eine eigene Seite. Sinnvoll, solange dein Unternehmen inhabergebunden ist: Dann ist der Ertragswert ohnehin nicht das, was ein Käufer zahlt.")],
          ], (v) => saveChoice("businessInNetWorth", "business_in_networth", v))}
        {/snippet}
        {@render section("business", Briefcase, t("Unternehmen im Gesamtvermögen"), t("Nur als „eigenes“ erfasste Firmen — Kaufkandidaten nie"), businessBody)}
      </section>

      <!-- Banks -->
      <section id="banks" class="scroll-mt-6 grid items-start gap-4 2xl:grid-cols-2">
        <h2 class="col-span-full flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-faint"><PlugZap class="size-3.5" /> {t("Bankanbindungen")}</h2>
        <IntegrationsSection onchange={load} />

        {#snippet syncBody()}
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {#each [["6h", t("alle 6 Std.")], ["12h", t("alle 12 Std.")], ["24h", t("täglich")], ["7d", t("wöchentlich")], ["manual", t("nur manuell")]] as [v, label] (v)}
              <button type="button" onclick={() => saveChoice("syncInterval", "sync_interval", v)} class={pill(settings?.syncInterval === v)}>{label}</button>
            {/each}
          </div>
          <!-- The limit is the reason for the options — so it stands here, not in a footnote. -->
          <p class="text-xs leading-relaxed text-muted">{t("Kürzer als 6 Stunden gibt es bewusst nicht: PSD2 erlaubt höchstens vier unbeaufsichtigte Abrufe pro Tag und Konto, und einzelne Banken deckeln strenger. Achilles hält sich auch dann daran, wenn die Einstellung anders gesetzt würde. Unabhängig davon läuft deine Bank-Zustimmung nach 90 Tagen ab und muss neu erteilt werden — „Jetzt syncen“ auf der Verbinden-Seite geht jederzeit.")}</p>
          {#if settings?.syncLastAuto}
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
              <span>{t("Zuletzt automatisch: {date}", { date: fmtDateTime(settings.syncLastAuto) })}</span>
              {#if settings.syncNextRun && settings.syncInterval !== "manual"}<span>{t("Nächster Lauf: {date}", { date: fmtDateTime(settings.syncNextRun) })}</span>{/if}
            </div>
          {/if}
        {/snippet}
        {@render section("sync", Timer, t("Automatischer Abruf"), t("Wie oft Achilles von sich aus bei der Bank nachfragt"), syncBody)}
      </section>

      <!-- Security -->
      <section id="security" class="scroll-mt-6 grid items-start gap-4 2xl:grid-cols-2">
        <h2 class="col-span-full text-xs font-semibold uppercase tracking-wider text-faint">{t("Login")}</h2>
        {#snippet authBadge()}
          {#if settings?.authEnabled}
            <Badge tone="pos"><CheckCircle2 class="size-3" /> {t("Aktiv")} ({settings.authUser})</Badge>
          {:else}
            <Badge tone="neg">{t("Kein Schutz")}</Badge>
          {/if}
        {/snippet}
        {#snippet authBody()}
          {#if !settings?.authEnabled}
            <Alert tone="warn">{t("Ohne Login kann jeder im Netzwerk deine Finanzdaten sehen und deine Bank-Zugangsdaten auslesen.")}</Alert>
          {/if}
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("Benutzername")}>
              <Input autocomplete="username" placeholder={settings?.authUser ?? "achilles"} bind:value={authUser} oninput={() => (authError = null)} />
            </Field>
            <Field label={settings?.authEnabled ? t("Neues Passwort") : t("Passwort")}>
              <Input type="password" autocomplete="new-password" placeholder={t("mindestens 8 Zeichen")} bind:value={authPass} oninput={() => (authError = null)} />
            </Field>
            {#if settings?.authEnabled}
              <Field label={t("Aktuelles Passwort")}>
                <Input type="password" autocomplete="current-password" bind:value={authCurrent} oninput={() => (authError = null)} />
              </Field>
            {/if}
          </div>
          {#if authError}<Alert tone="neg">{authError}</Alert>{/if}
          <div class="flex flex-wrap items-center gap-2">
            <Button onclick={() => saveAuth(false)} disabled={busy || !authUser || !authPass}>
              {settings?.authEnabled ? t("Zugangsdaten ändern") : t("Login aktivieren")}
            </Button>
            {#if settings?.authEnabled}
              <Button variant="danger" onclick={() => saveAuth(true)} disabled={busy || !authCurrent}>{t("Login deaktivieren")}</Button>
              <Button variant="ghost" onclick={logout}><LogOut /> {t("Abmelden")}</Button>
            {/if}
            {#if authSaved}<span class="flex items-center gap-1.5 text-sm text-pos"><CheckCircle2 class="size-4" /> {t("Gespeichert")}</span>{/if}
          </div>
          <p class="text-[11px] leading-relaxed text-muted">{t("Passkeys sind noch nicht umgesetzt — bis dahin schützt das Passwort. Für Zugriff von außerhalb des LAN gehört ohnehin ein Reverse-Proxy mit HTTPS davor.")}</p>
        {/snippet}
        {@render section("auth", Lock, t("Login"), t("Schützt das Dashboard mit Benutzername und Passwort"), authBody, authBadge)}
      </section>

      <!-- Data -->
      <section id="data" class="scroll-mt-6 grid items-start gap-4 2xl:grid-cols-2">
        <h2 class="col-span-full text-xs font-semibold uppercase tracking-wider text-faint">{t("Daten & Backup")}</h2>

        {#snippet backupBody()}
          <p class="text-xs leading-relaxed text-muted">{t("Die Datei enthält alles: Konten, Buchungen, Bestände, Szenarien — und deinen Bank-Private-Key. Sie wird mit AES-256 aus deinem Passwort verschlüsselt. Ohne dieses Passwort ist sie nicht wiederherstellbar; es gibt keine Hintertür.")}</p>
          <Field label={t("Backup-Passwort")} class="sm:w-2/3">
            <Input type="password" autocomplete="off" placeholder={t("mindestens 8 Zeichen")} bind:value={bakPass} oninput={() => (bakError = null)} />
          </Field>
          {#if bakError}<Alert tone="neg">{bakError}</Alert>{/if}
          {#if bakInfo}<Alert tone="pos">{bakInfo}</Alert>{/if}
          <Button onclick={downloadBackup} disabled={bakBusy !== null || bakPass.length < 8}>
            <Download /> {bakBusy === "backup" ? t("Erstelle …") : t("Backup herunterladen")}
          </Button>

          <div class="border-t border-line pt-4">
            <div class="mb-2 text-sm font-semibold">{t("Wiederherstellen")}</div>
            <input bind:this={restoreInput} type="file" accept=".achillesbak" class="hidden" onchange={(e) => { restoreFile = e.currentTarget.files?.[0] ?? null; bakError = null; }} />
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onclick={() => restoreInput?.click()}><Upload /> {restoreFile ? restoreFile.name : t("Datei auswählen")}</Button>
              <Button variant="danger" onclick={doRestore} disabled={bakBusy !== null || !restoreFile || bakPass.length < 8}>
                {bakBusy === "restore" ? t("Stelle wieder her …") : t("Wiederherstellen")}
              </Button>
            </div>
            <p class="mt-2 text-[11px] leading-relaxed text-muted">{t("Ersetzt alle aktuellen Daten durch den Inhalt des Backups. Nutze oben dasselbe Passwort, mit dem die Datei erstellt wurde.")}</p>
          </div>
        {/snippet}
        {@render section("backup", Archive, t("Backup"), t("Verschlüsselte Sicherung aller Daten (.achillesbak)"), backupBody)}

        {#snippet demoBadge()}{#if settings?.demoMode}<Badge tone="info">{t("Aktiv")}</Badge>{/if}{/snippet}
        {#snippet demoBody()}
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onclick={openDemoWarning}><Sparkles /> {t("Demo-Daten laden")}</Button>
            <Button variant="danger" disabled={busy || !settings?.demoMode} onclick={() => toggleDemo(false)}>{t("Demo-Daten entfernen")}</Button>
          </div>
        {/snippet}
        {@render section("demo", Sparkles, t("Demo-Modus"), t("Realistische Beispieldaten zum Erkunden des Dashboards"), demoBody, demoBadge)}

        {#snippet servicesBody()}
          <Button variant="secondary" size="sm" onclick={() => (servicesOpen = true)}>{t("Ansehen")}</Button>
        {/snippet}
        {@render section("services", ShieldCheck, t("Externe Dienste"), t("{n} Dienste · was abgerufen wird und was dabei rausgeht", { n: SERVICES.length }), servicesBody)}

        {#snippet hostingBody()}
          <p class="text-xs leading-relaxed text-muted">{t("Alle Daten liegen in einer SQLite-Datenbank unter /data/achilles.db im Container-Volume. Für Backups genügt es, diese Datei zu sichern. Spotpreise und Wechselkurse kommen von gold-api.com, Yahoo Finance und frankfurter.dev — es verlassen keine persönlichen Daten deinen Server.")}</p>
        {/snippet}
        {@render section("hosting", Database, t("Daten & Hosting"), t("Alles bleibt bei dir"), hostingBody)}
      </section>

      <!-- Updates -->
      <section id="updates" class="scroll-mt-6 grid items-start gap-4 2xl:grid-cols-2">
        <h2 class="col-span-full text-xs font-semibold uppercase tracking-wider text-faint">{t("Updates")}</h2>
        {#snippet updBadge()}
          {#if upd}
            {#if upd.checkFailed}<Badge>{t("Prüfung fehlgeschlagen")}</Badge>
            {:else if upd.upToDate}<Badge tone="pos"><CheckCircle2 class="size-3" /> {t("Aktuell")}</Badge>
            {:else if upd.updateAvailable && upd.latest}<Badge tone="accent">{t("Version {v} verfügbar", { v: upd.latest.version })}</Badge>{/if}
          {/if}
        {/snippet}
        {#snippet updBody()}
          <div class="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
            <span class="flex items-center gap-1.5"><GitBranch class="size-3" /> {upd?.repo ?? "…"} · {upd?.branch ?? ""}</span>
            <span>
              {t("Installiert")}: <span class="num font-semibold text-ink">{upd?.version.version ? `v${upd.version.version}` : t("unbekannt")}</span>
              {#if upd?.version.shortSha}<span class="num ml-1 opacity-60">({upd.version.shortSha})</span>{/if}
              {#if upd?.version.deployedAt}{` · ${fmtDateTime(upd.version.deployedAt)}`}{/if}
            </span>
            {#if upd?.latest}<span>{t("Neueste")}: <span class="num text-ink">v{upd.latest.version}</span></span>{/if}
            {#if upd}<a href={upd.releasesUrl} target="_blank" rel="noreferrer" class="font-medium text-accent hover:underline">{t("Alle Versionen →")}</a>{/if}
          </div>

          {#if !running && upd?.status.state === "success" && upd.status.message}
            <Alert tone="pos">{upd.status.message}</Alert>
          {/if}
          {#if !running && upd?.status.state === "error"}
            <Alert tone="neg">
              <div>{t("Letztes Update fehlgeschlagen")}</div>
              {#if upd.status.message}<div class="mt-0.5 text-xs opacity-80">{upd.status.message}</div>{/if}
            </Alert>
          {/if}
          {#if upd?.checkFailed}
            <Alert tone="info">{t("Die Version auf GitHub konnte nicht geprüft werden — meist das Stundenlimit der GitHub-API (60 Anfragen ohne Token) oder fehlendes Internet. Später erneut versuchen.")}</Alert>
          {/if}

          {#if upd?.updateAvailable && upd.latest}
            <div class="rounded-xl bg-surface-2 p-4">
              <div class="mb-2 text-xs font-medium text-muted">{t("Neu in v{v}", { v: upd.latest.version })}</div>
              {#if upd.latest.notes}
                <pre class="max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-2">{upd.latest.notes}</pre>
              {:else}
                <!-- A tag without a GitHub release has no notes — say so and show the way. -->
                <div class="text-xs text-ink-2">
                  {t("Für diese Version sind keine Patchnotes hinterlegt (Tag ohne Release).")}
                  <a href={upd.releasesUrl} target="_blank" rel="noreferrer" class="font-medium text-accent underline underline-offset-2">{t("Änderungen auf GitHub ansehen")}</a>
                </div>
              {/if}
            </div>
          {/if}

          <div class="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onclick={() => loadUpdate(true)} disabled={running}>
              <RefreshCw class={running ? "animate-spin" : ""} /> {t("Nach Updates suchen")}
            </Button>
            {#if upd?.canUpdate && upd.updateAvailable && upd.latest}
              <Button onclick={() => (updDialog = true)} disabled={running}><Download /> {t("Auf v{v} aktualisieren", { v: upd.latest.version })}</Button>
            {/if}
            {#if running}
              <Button variant="secondary" onclick={() => (updDialog = true)}><RefreshCw class="animate-spin" /> {t("Fortschritt anzeigen")}</Button>
            {/if}
          </div>

          <!-- Desktop app: not a command but a download -->
          {#if upd && !upd.canUpdate && upd.installMethod === "desktop"}
            <div class="rounded-xl bg-surface-2 p-4 text-xs leading-relaxed text-ink-2">
              {t("Neue Version herunterladen und über die alte in den Programme-Ordner ziehen. Deine Daten bleiben erhalten.")}
              <a href={upd.releasesUrl} target="_blank" rel="noreferrer" class="mt-2 block font-medium text-accent hover:underline">{t("Zu den Downloads")} →</a>
            </div>
          {/if}

          <!-- Fallback without a control channel -->
          {#if upd && !upd.canUpdate && upd.installMethod !== "desktop" && upd.shellCommand}
            <div class="space-y-2 rounded-xl bg-surface-2 p-4">
              <div class="flex items-center gap-2 text-xs text-ink-2">
                <Terminal class="size-3.5 shrink-0 text-muted" />
                {upd.control === "readonly"
                  ? t("Keine Schreibrechte im Control-Verzeichnis — einmalig in der Proxmox-Shell ausführen (kein Container-Passwort nötig):")
                  : upd.installMethod === "deb"
                    ? t("Diese Installation wird über apt aktualisiert:")
                    : t("In-App-Updates sind hier nicht eingerichtet. Per Shell aktualisieren:")}
              </div>
              {@render codeLine(upd.fixCommand ?? upd.shellCommand)}
            </div>
          {/if}
        {/snippet}
        {@render section("update", Download, t("Updates"), t("Neue Versionen von GitHub"), updBody, updBadge)}
      </section>
    </div>
  </div>
</div>

<UpdateDialog bind:open={updDialog} info={upd} onstarted={() => loadUpdate()} onfinished={() => loadUpdate()} />

<Dialog
  bind:open={servicesOpen}
  title={t("Externe Dienste")}
  description={t("Jede Verbindung, die Achilles von sich aus nach außen aufbaut — vollständig. Alles andere bleibt auf deinem Server.")}
  class="max-w-2xl"
>
  <div class="space-y-3">
    {#each SERVICES as sv (sv.host)}
      <div class="rounded-xl border border-line p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="num font-mono text-sm font-semibold">{sv.host}</span>
          <Badge tone={sv.optional ? "info" : "neutral"}>{sv.optional ? t("nur bei Nutzung") : t("immer")}</Badge>
        </div>
        <div class="mt-2 space-y-1.5 text-xs leading-relaxed">
          <div class="text-ink-2">{sv.purpose[prefs.lang]}</div>
          <!-- Highlight what matters most: what leaves the server -->
          <div class="flex gap-2"><span class="shrink-0 text-muted">{t("Sendet:")}</span><span class="font-medium text-ink">{sv.sends[prefs.lang]}</span></div>
          <div class="flex gap-2"><span class="shrink-0 text-muted">{t("Wann:")}</span><span class="text-ink-2">{sv.when[prefs.lang]}</span></div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-muted">
            <!-- Name the source so the claims can be checked -->
            <span class="num font-mono">{sv.source}</span>
            {#if sv.privacyUrl}<a href={sv.privacyUrl} target="_blank" rel="noreferrer" class="font-medium text-accent underline underline-offset-2">{t("Datenschutzerklärung")}</a>{/if}
          </div>
        </div>
      </div>
    {/each}
    <p class="pt-1 text-[11px] leading-relaxed text-muted">{t("Kurse und Wechselkurse werden ohne Anmeldung abgerufen — die Dienste sehen die IP deines Servers und das abgefragte Symbol, sonst nichts. Achilles sendet keine Telemetrie und bindet keine Skripte, Schriften oder Zählpixel von Dritten ein.")}</p>
  </div>
</Dialog>

<Dialog
  bind:open={demoWarning}
  title={t("Demo-Daten laden?")}
  description={t("Demo-Daten landen in derselben Datenbank wie deine echten Daten — nicht in einem getrennten Modus.")}
>
  <div class="space-y-3">
    {#if demoCounts && demoCounts.accounts > 0}
      <Alert tone="neg">
        {t("Du hast bereits {n} echtes Konto verbunden.", { n: demoCounts.accounts })}
        {t("Die Demo-Buchungen mischen sich in deine Transaktionsliste und verfälschen Auswertungen wie Sparquote und Kategorien.")}
      </Alert>
    {/if}
    <div class="rounded-xl bg-surface-2 p-4 text-xs leading-relaxed">
      <div class="mb-2 font-medium text-muted">{t("Was passiert")}</div>
      <ul class="space-y-1.5 text-ink-2">
        <li class="flex gap-2"><span class="text-warn">•</span>{t("Ein Demo-Konto und rund 300 Buchungen aus 8 Monaten werden angelegt.")}</li>
        <li class="flex gap-2"><span class="text-warn">•</span>{t("Edelmetalle, Investments, Vorsorge und FIRE-Szenarien werden nur angelegt, wenn dort noch nichts steht — deine eigenen Einträge bleiben unangetastet.")}</li>
        <li class="flex gap-2"><span class="text-pos">•</span>{t("Alles Demo-Erzeugte ist markiert und lässt sich über „Demo-Daten entfernen“ rückstandsfrei löschen.")}</li>
      </ul>
    </div>
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (demoWarning = false)} disabled={busy}>{t("Abbrechen")}</Button>
    <Button onclick={() => toggleDemo(true)} disabled={busy}>{busy ? t("Lade …") : t("Trotzdem laden")}</Button>
  {/snippet}
</Dialog>
