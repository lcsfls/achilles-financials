<script lang="ts" module>
  export type UpdateDialogInfo = {
    version: { version: string | null; shortSha: string | null };
    status: { state: "idle" | "requested" | "running" | "success" | "error"; message?: string };
    log: string | null;
    latest: { version: string; tag: string; notes: string | null } | null;
  };
</script>

<script lang="ts">
  import { CheckCircle2, PlugZap, Package, GitPullRequest, Hammer, RotateCw, Terminal } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import { t } from "$lib/i18n";
  import { cn } from "$lib/utils";

  /** Rough phase from the log — the user wants to know where it stands. */
  type Phase = "waiting" | "fetching" | "building" | "restarting" | "done";

  /**
   * Search from the end: the log always contains the start too ("update
   * gestartet"), so a search over the whole text would stay on "fetching"
   * forever. The markers come from real `docker compose up --build` output.
   */
  function phaseFromLog(log: string | null, state: string): Phase {
    if (state === "success") return "done";
    if (!log) return "waiting";
    const lines = log.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].toLowerCase();
      if (/container\s+achilles|recreated|\bstarting\b|\bstarted\b|naming to/.test(l)) return "restarting";
      if (/^#\d+\s|\[builder|\[runner|=> \[|\bdone\b\s|exporting to image/.test(l)) return "building";
      if (/update gestartet|from github|fetch_head|head is now at/.test(l)) return "fetching";
    }
    return "waiting";
  }

  const PHASES: Array<{ key: Phase; label: string; icon: typeof Package }> = [
    { key: "fetching", label: "Version wird geladen", icon: GitPullRequest },
    { key: "building", label: "Container wird gebaut", icon: Hammer },
    { key: "restarting", label: "Neustart", icon: RotateCw },
  ];
  const ORDER: Phase[] = ["waiting", "fetching", "building", "restarting", "done"];

  let {
    open = $bindable(false),
    info,
    onstarted,
    onfinished,
  }: { open?: boolean; info: UpdateDialogInfo | null; onstarted?: () => void; onfinished?: () => void } = $props();

  let starting = $state(false);
  /**
   * Was an update started in this dialog session? The status file survives
   * every run: after a successful update — even one from the shell — it says
   * "success" for good. Choosing the view from the status alone would show
   * that old result on opening and never offer to start.
   */
  let startedHere = $state(false);
  let error = $state<string | null>(null);
  let live = $state<UpdateDialogInfo | null>(null);
  // During the rebuild the container is gone — expected, not an error
  let unreachable = $state(false);
  let logEl: HTMLPreElement | undefined = $state();

  const current = $derived(live ?? info);
  const st = $derived(current?.status.state ?? "idle");
  const running = $derived(st === "requested" || st === "running");
  // A finished result counts only when the run was started here. A running
  // update is always shown — then nobody may start another next to it.
  const finished = $derived(startedHere && (st === "success" || st === "error"));
  const confirming = $derived(!running && !finished);
  const phase = $derived(phaseFromLog(current?.log ?? null, st));

  async function poll() {
    try {
      // statusOnly: the poll needs no GitHub and must not drain its rate limit
      const res = await fetch("/api/update?statusOnly=1", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const d = await res.json();
      live = { ...d, latest: d.latest ?? live?.latest ?? info?.latest ?? null };
      unreachable = false;
    } catch {
      // Connection gone = container restarting. Expected, don't report.
      unreachable = true;
    }
  }

  $effect(() => {
    if (!open || !running) return;
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  });

  // Follow the log so the current line stays visible
  $effect(() => {
    void current?.log;
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  });

  let reported = false;
  $effect(() => {
    if (startedHere && st === "success" && !reported) { reported = true; onfinished?.(); }
  });

  async function start() {
    starting = true;
    error = null;
    const res = await fetch("/api/update", { method: "POST" });
    starting = false;
    if (!res.ok) { error = t((await res.json()).error); return; }
    startedHere = true;
    reported = false;
    onstarted?.();
    poll();
  }

  function reset() { live = null; error = null; unreachable = false; startedHere = false; }

  const title = $derived(
    confirming
      ? current?.latest ? t("Auf v{v} aktualisieren", { v: current.latest.version }) : t("Update installieren")
      : running ? t("Update läuft")
      : st === "success" ? t("Update abgeschlossen") : t("Update fehlgeschlagen")
  );
  const description = $derived(
    confirming ? t("Der Container wird neu gebaut und startet neu. Deine Daten bleiben unberührt.")
      : running ? t("Fenster offen lassen — bei laufendem Build ist das normal.")
      : current?.status.message ?? null
  );
</script>

<!-- Not dismissable while running — otherwise you'd miss the result -->
<Dialog bind:open {title} {description} dismissable={!running} onclose={reset}>
  {#if confirming}
    <div class="space-y-4">
      <div class="flex items-center justify-center gap-5 rounded-xl bg-surface-2 p-4 text-sm">
        <div class="text-center">
          <div class="text-xs text-muted">{t("Installiert")}</div>
          <div class="num mt-0.5 font-semibold">v{current?.version.version ?? "?"}</div>
        </div>
        <div class="text-faint">→</div>
        <div class="text-center">
          <div class="text-xs text-muted">{t("Neu")}</div>
          <div class="num mt-0.5 font-semibold text-accent">v{current?.latest?.version ?? "?"}</div>
        </div>
      </div>
      {#if current?.latest?.notes}
        <div class="rounded-xl bg-surface-2 p-4">
          <div class="mb-2 text-xs font-medium text-muted">{t("Neu in v{v}", { v: current.latest.version })}</div>
          <pre class="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-2">{current.latest.notes}</pre>
        </div>
      {/if}
      <Alert tone="warn">{t("Der Build dauert einige Minuten. Das Dashboard ist zwischendurch kurz nicht erreichbar — dieses Fenster bleibt offen und zeigt den Fortschritt.")}</Alert>
      {#if error}<Alert tone="neg">{error}</Alert>{/if}
    </div>
  {:else if running}
    <div class="space-y-4">
      <div class="space-y-2">
        {#each PHASES as p (p.key)}
          {@const done = ORDER.indexOf(phase) > ORDER.indexOf(p.key)}
          {@const active = phase === p.key}
          <div class={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all", active ? "border-accent/40 bg-accent-soft" : done ? "border-pos/25 bg-pos-soft" : "border-line opacity-55")}>
            {#if done}<CheckCircle2 class="size-4 shrink-0 text-pos" />{:else}<p.icon class={cn("size-4 shrink-0", active ? "animate-pulse text-accent" : "text-faint")} />{/if}
            <span class={cn("text-sm", active ? "font-medium text-accent" : done ? "text-ink-2" : "text-muted")}>{t(p.label)}</span>
          </div>
        {/each}
      </div>
      {#if unreachable}
        <Alert tone="info"><span class="inline-flex items-center gap-1.5"><PlugZap class="size-3.5 animate-pulse" />{t("Container antwortet gerade nicht — er wird neu gestartet. Das Fenster verbindet sich automatisch wieder.")}</span></Alert>
      {/if}
      {#if current?.log}
        <div>
          <div class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted"><Terminal class="size-3" /> {t("Build-Ausgabe")}</div>
          <pre bind:this={logEl} class="max-h-44 overflow-y-auto rounded-xl bg-surface-3 p-3 font-mono text-[10px] leading-relaxed text-ink-2">{current.log}</pre>
        </div>
      {/if}
    </div>
  {:else if st === "success"}
    <div class="flex items-center justify-center gap-3 rounded-xl bg-pos-soft p-5 text-pos">
      <Package class="size-5" />
      <span class="num text-lg font-semibold">v{current?.version.version ?? "?"}</span>
    </div>
  {:else}
    {#if current?.log}
      <pre class="max-h-52 overflow-y-auto rounded-xl bg-surface-3 p-3 font-mono text-[10px] leading-relaxed text-ink-2">{current.log}</pre>
    {/if}
    <p class="mt-3 text-xs leading-relaxed text-muted">{t("Die alte Version läuft weiter. Vollständiges Log auf dem Host unter control/update.log.")}</p>
  {/if}

  {#snippet footer()}
    {#if confirming}
      <Button variant="secondary" onclick={() => (open = false)} disabled={starting}>{t("Abbrechen")}</Button>
      <Button onclick={start} disabled={starting}>{starting ? t("Starte …") : t("Jetzt aktualisieren")}</Button>
    {:else if st === "success" && finished}
      <Button onclick={() => window.location.reload()}><RotateCw /> {t("Seite neu laden")}</Button>
    {:else if finished}
      <Button variant="secondary" onclick={() => (open = false)}>{t("Schließen")}</Button>
      <Button onclick={start} disabled={starting}>{t("Erneut versuchen")}</Button>
    {/if}
  {/snippet}
</Dialog>
