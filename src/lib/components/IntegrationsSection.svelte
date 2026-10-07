<script lang="ts">
  import { onMount } from "svelte";
  import { Globe, Landmark, ExternalLink, RefreshCw } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Textarea from "$lib/components/ui/Textarea.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import IntegrationCard, { type Requirement } from "$lib/components/IntegrationCard.svelte";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { COUNTRIES } from "$lib/countries";
  import { apiJson, fmtDateTime } from "$lib/utils";

  type Integrations = { integrations: Array<{ id: "enablebanking" | "fints"; enabled: boolean; configured: boolean }> };
  type EbSettings = { ebConfigured: boolean; ebAppIdMasked: string | null; country: string; appUrl: string; appUrlSource: string; callbackUrl: string };
  type FinTs = { url: string; blz: string; user: string; pinSet: boolean; productId: string; lastSync: string | null };

  let { onchange }: { onchange?: () => void } = $props();

  let integ = $state<Integrations | null>(null);
  let eb = $state<EbSettings | null>(null);
  let fints = $state<FinTs | null>(null);

  // Enable Banking
  let appId = $state("");
  let privateKey = $state("");
  let appUrl = $state("");
  let country = $state("DE");
  let ebMsg = $state<{ ok: boolean; text: string } | null>(null);

  // FinTS
  let fUrl = $state("");
  let fBlz = $state("");
  let fUser = $state("");
  let fPin = $state("");
  let fProduct = $state("");
  let fMsg = $state<{ ok: boolean; text: string } | null>(null);
  let busy = $state<string | null>(null);

  async function load() {
    const [i, s, f] = await Promise.all([
      apiJson<Integrations>("/api/integrations"),
      apiJson<EbSettings>("/api/settings"),
      apiJson<FinTs>("/api/fints"),
    ]);
    integ = i;
    eb = s;
    appUrl = s.appUrl ?? "";
    country = s.country ?? "DE";
    fints = f;
    fUrl = f.url; fBlz = f.blz; fUser = f.user; fProduct = f.productId;
  }
  onMount(load);

  async function toggle(id: "enablebanking" | "fints", enabled: boolean) {
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    await load();
    onchange?.();
  }

  async function saveEb() {
    busy = "eb";
    ebMsg = null;
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ebAppId: appId || undefined, ebPrivateKey: privateKey || undefined, appUrl, country }),
    });
    busy = null;
    if (!res.ok) { ebMsg = { ok: false, text: t((await res.json()).error) }; return; }
    appId = ""; privateKey = "";
    ebMsg = { ok: true, text: t("Gespeichert") };
    load();
  }

  async function saveFints() {
    busy = "fints";
    fMsg = null;
    const res = await fetch("/api/fints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fUrl, blz: fBlz, user: fUser, pin: fPin || undefined, productId: fProduct }),
    });
    busy = null;
    if (!res.ok) { fMsg = { ok: false, text: t((await res.json()).error) }; return; }
    fPin = "";
    fMsg = { ok: true, text: t("Gespeichert") };
    load();
  }

  async function testFints() {
    busy = "fints-test";
    fMsg = null;
    const res = await fetch("/api/fints", { method: "PUT" });
    const d = await res.json();
    busy = null;
    if (!res.ok) { fMsg = { ok: false, text: d.error }; return; }
    fMsg = { ok: true, text: t("Verbindung steht — {n} Konten gefunden: {list}", { n: d.accounts.length, list: d.accounts.map((a: { name: string }) => a.name).join(", ") }) };
  }

  async function syncFints() {
    busy = "fints-sync";
    fMsg = null;
    const res = await fetch("/api/fints/sync", { method: "POST" });
    const d = await res.json();
    busy = null;
    if (!res.ok) { fMsg = { ok: false, text: d.error }; return; }
    fMsg = { ok: true, text: t("Synchronisiert: {a} Konten, {n} Transaktionen.", { a: d.accounts, n: d.transactions }) };
    load();
    onchange?.();
  }

  const find = (id: "enablebanking" | "fints") => integ?.integrations.find((i) => i.id === id);

  const EB_REQ = $derived<Requirement[]>([
    { kind: "need", text: t("Eine öffentlich erreichbare HTTPS-Domain. Enable Banking lehnt http:// und lokale IPs ab („scheme not supported“). Ein Reverse-Proxy mit echtem Zertifikat genügt — das Zertifikat muss dein Handy akzeptieren.") },
    { kind: "need", text: t("Eine veröffentlichte Datenschutzerklärung und AGB plus eine Datenschutz-Kontaktmail. Enable Banking prüft laufend, ob die Links erreichbar bleiben.") },
    { kind: "need", text: t("Ein kostenloser Account auf enablebanking.com und eine dort registrierte Anwendung (Application-ID + Private Key).") },
    { kind: "good", text: t("Dafür: 2.700+ Banken in 30 europäischen Ländern, auch Revolut, N26, Wise und bunq.") },
  ]);

  const FINTS_REQ = $derived<Requirement[]>([
    { kind: "need", text: t("Nur deutsche Banken. Revolut, N26, Wise und bunq sind nicht erreichbar — die sind nicht deutsch lizenziert.") },
    { kind: "need", text: t("Eine Produktregistrierungsnummer der Deutschen Kreditwirtschaft. Kostenlos über fints.org, aber mit 10–15 Werktagen Bearbeitungszeit. Ohne sie lehnen die meisten Banken mit „3078 Software nicht als FinTS-Produkt registriert“ ab.") },
    { kind: "warn", text: t("Der interaktive TAN-Dialog ist noch nicht umgesetzt. Verlangt deine Bank beim Abruf eine TAN (üblich alle 90 Tage), schlägt der Sync fehl.") },
    { kind: "warn", text: t("Immer mehr Banken stellen FinTS zugunsten von PSD2 ein.") },
    { kind: "good", text: t("Dafür: kein Redirect, keine Domain, kein Aggregator — dein Server spricht direkt mit der Bank.") },
  ]);
</script>

{#if integ && eb && fints}
  <div class="space-y-4">
    <IntegrationCard
      icon={Globe}
      title="Enable Banking"
      subtitle={t("PSD2 · 2.700+ Banken in Europa · braucht HTTPS-Domain")}
      enabled={find("enablebanking")?.enabled ?? false}
      configured={find("enablebanking")?.configured ?? false}
      requirements={EB_REQ}
      docsUrl="https://enablebanking.com"
      docsLabel="enablebanking.com"
      ontoggle={(on) => toggle("enablebanking", on)}
    >
      <Field label={t("Öffentliche Adresse dieser Instanz")}>
        <Input placeholder="https://achilles.deine-domain.de" bind:value={appUrl} oninput={() => (ebMsg = null)} />
      </Field>

      <div class="rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs">
        <div class="flex flex-wrap items-center gap-x-2">
          <span class="text-muted">{t("Redirect-URL für das Control Panel")}:</span>
          <code class="break-all font-mono text-ink">{eb.callbackUrl}</code>
        </div>
        {#if !eb.callbackUrl.startsWith("https://")}
          <div class="mt-1.5 text-warn">{t("Kein HTTPS — Enable Banking wird diese Redirect-URL in der Produktivumgebung ablehnen.")}</div>
        {/if}
      </div>

      <Field label="Application ID">
        <Input placeholder={eb.ebConfigured ? `•••••••• (${eb.ebAppIdMasked})` : "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"} bind:value={appId} />
      </Field>
      <Field label={t("Private Key (.pem-Inhalt)")}>
        <Textarea rows={3} spellcheck={false} class="font-mono text-[11px]" placeholder={eb.ebConfigured ? "•••••••• (gesetzt)" : "-----BEGIN PRIVATE KEY-----\n…"} bind:value={privateKey} />
      </Field>
      <Field label={t("Land deiner Bank")} class="sm:w-1/2">
        <Select bind:value={country} options={COUNTRIES.map((c) => ({ value: c.code, label: prefs.lang === "de" ? c.de : c.en }))} />
      </Field>

      {#if ebMsg}<Alert tone={ebMsg.ok ? "pos" : "neg"}>{ebMsg.text}</Alert>{/if}
      <Button onclick={saveEb} disabled={busy !== null}>{busy === "eb" ? t("Speichern …") : t("Speichern")}</Button>
    </IntegrationCard>

    <IntegrationCard
      icon={Landmark}
      title="FinTS / HBCI"
      subtitle={t("Direkt zur Bank · nur Deutschland · braucht Produktregistrierung")}
      enabled={find("fints")?.enabled ?? false}
      configured={find("fints")?.configured ?? false}
      requirements={FINTS_REQ}
      docsUrl="https://www.fints.org/de/hersteller/produktregistrierung"
      docsLabel={t("Produktregistrierung beantragen")}
      ontoggle={(on) => toggle("fints", on)}
      accent="var(--info)"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("Bankleitzahl (8 Ziffern)")}><Input inputmode="numeric" placeholder="12030000" bind:value={fBlz} oninput={() => (fMsg = null)} /></Field>
        <Field label={t("FinTS-URL deiner Bank")}><Input placeholder="https://fints.deine-bank.de/fints" bind:value={fUrl} oninput={() => (fMsg = null)} /></Field>
        <Field label={t("Benutzerkennung")}><Input autocomplete="off" bind:value={fUser} oninput={() => (fMsg = null)} /></Field>
        <Field label={t("Online-Banking-PIN")}><Input type="password" autocomplete="new-password" placeholder={fints.pinSet ? "•••••••• (gesetzt)" : ""} bind:value={fPin} oninput={() => (fMsg = null)} /></Field>
      </div>

      <div>
        <Field label={t("Produktregistrierungsnummer")}><Input placeholder="z. B. 1234567890ABCDEF" bind:value={fProduct} oninput={() => (fMsg = null)} /></Field>
        <p class="mt-1 text-[11px] leading-relaxed text-muted">
          {t("Ohne diese Nummer lehnen die meisten Banken ab.")}
          <a href="https://www.fints.org/de/hersteller/produktregistrierung" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            {t("Kostenlos beantragen")} <ExternalLink class="size-3" />
          </a>
        </p>
      </div>

      <p class="text-[11px] leading-relaxed text-muted">{t("PIN und Zugangsdaten liegen ausschließlich in deiner lokalen SQLite-Datenbank — sie verlassen deinen Server nur zur Bank selbst.")}</p>

      {#if fMsg}<Alert tone={fMsg.ok ? "pos" : "neg"}>{fMsg.text}</Alert>{/if}

      <div class="flex flex-wrap items-center gap-2">
        <Button onclick={saveFints} disabled={busy !== null}>{busy === "fints" ? t("Speichern …") : t("Speichern")}</Button>
        <Button variant="secondary" onclick={testFints} disabled={busy !== null || !find("fints")?.configured}>{busy === "fints-test" ? t("Prüfe …") : t("Verbindung testen")}</Button>
        <Button variant="secondary" onclick={syncFints} disabled={busy !== null || !find("fints")?.configured}>
          <RefreshCw class={busy === "fints-sync" ? "animate-spin" : ""} /> {busy === "fints-sync" ? t("Läuft …") : t("Jetzt syncen")}
        </Button>
        {#if fints.lastSync}<span class="text-[11px] text-muted">{t("zuletzt {date}", { date: fmtDateTime(fints.lastSync) })}</span>{/if}
      </div>
    </IntegrationCard>
  </div>
{/if}
