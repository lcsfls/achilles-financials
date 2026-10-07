<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { applyLang, applyTheme, loadFx, prefs, type Theme } from "$lib/prefs.svelte";
  import AppShell from "$lib/components/AppShell.svelte";

  let { data, children } = $props();

  // Language is known on the server (hooks.server.ts applies it for SSR); a
  // pre-effect so the client switches before the first paint.
  $effect.pre(() => applyLang(data.lang));

  onMount(() => {
    try {
      const t = localStorage.getItem("achilles-theme");
      if (t === "light" || t === "dark" || t === "system") prefs.theme = t as Theme;
    } catch { /* private mode */ }
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => applyTheme();
    mq.addEventListener("change", onScheme);

    loadFx();

    // Service worker after load, so registration never competes with first paint.
    if ("serviceWorker" in navigator) {
      const reg = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
      if (document.readyState === "complete") reg();
      else window.addEventListener("load", reg, { once: true });
    }
    return () => mq.removeEventListener("change", onScheme);
  });

  const bare = $derived(page.url.pathname === "/setup" || page.url.pathname === "/login");
</script>

{#if bare}
  <div class="min-h-screen">{@render children()}</div>
{:else}
  <AppShell authEnabled={data.authEnabled}>{@render children()}</AppShell>
{/if}
