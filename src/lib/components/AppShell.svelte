<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";
  import {
    LayoutDashboard, ArrowLeftRight, Gem, TrendingUp, Eye, QrCode, Settings, Shield, ShieldCheck, Flame,
    PiggyBank, HandCoins, Home, Briefcase, Menu, X, LogOut, Sun, Moon, Monitor, Split,
  } from "@lucide/svelte";
  import { t } from "$lib/i18n";
  import { apiJson, cn } from "$lib/utils";
  import { prefs, setTheme, type Theme } from "$lib/prefs.svelte";

  let { authEnabled = false, children }: { authEnabled?: boolean; children: Snippet } = $props();

  const GROUPS = [
    {
      label: null,
      items: [
        { href: "/", label: "Übersicht", icon: LayoutDashboard },
        { href: "/transactions", label: "Transaktionen", icon: ArrowLeftRight },
        { href: "/cashflow", label: "Cashflow", icon: Split },
      ],
    },
    {
      label: "Vermögen",
      items: [
        { href: "/investments", label: "Investments", icon: TrendingUp },
        { href: "/watchlist", label: "Watchlist", icon: Eye },
        { href: "/metals", label: "Edelmetalle", icon: Gem },
        { href: "/pension", label: "Vorsorge", icon: PiggyBank },
        { href: "/realestate", label: "Immobilien", icon: Home },
        { href: "/business", label: "Unternehmenswert", icon: Briefcase },
        { href: "/loans", label: "Kredite", icon: HandCoins },
      ],
    },
    {
      label: "Planung",
      items: [
        { href: "/emergency", label: "Notgroschen", icon: ShieldCheck },
        { href: "/fire", label: "FIRE", icon: Flame },
      ],
    },
  ];

  /**
   * Sits apart from the lists above: these are not places you go to look at
   * something, they are where you go to change something — and settings is
   * where the update notice belongs.
   */
  const FOOT = [
    { href: "/connect", label: "Verbinden", icon: QrCode },
    { href: "/settings", label: "Einstellungen", icon: Settings },
  ];

  /** Bottom tabs on phones — the four places you open most, plus the drawer. */
  const TABS = [
    { href: "/", label: "Übersicht", icon: LayoutDashboard },
    { href: "/transactions", label: "Transaktionen", icon: ArrowLeftRight },
    { href: "/investments", label: "Investments", icon: TrendingUp },
    { href: "/fire", label: "FIRE", icon: Flame },
  ];

  let drawer = $state(false);
  let updateAvailable = $state(false);

  const path = $derived(page.url.pathname);
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  afterNavigate(() => (drawer = false));

  /*
   * Once per page load, not per navigation: the shell survives client-side
   * route changes, and the release lookup goes out to GitHub. Only `true` shows
   * the badge — null means "could not check", which must not look like an update.
   */
  onMount(() => {
    apiJson<{ updateAvailable: boolean | null }>("/api/update")
      .then((u) => (updateAvailable = u.updateAvailable === true))
      .catch(() => {});
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const THEMES: Array<{ value: Theme; icon: typeof Sun; label: string }> = [
    { value: "light", icon: Sun, label: "Hell" },
    { value: "dark", icon: Moon, label: "Dunkel" },
    { value: "system", icon: Monitor, label: "System" },
  ];
</script>

{#snippet navLink(item: { href: string; label: string; icon: typeof Sun }, badge = false)}
  {@const active = isActive(item.href)}
  <a
    href={item.href}
    aria-current={active ? "page" : undefined}
    class={cn(
      "group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors",
      active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-3 hover:text-ink"
    )}
  >
    <item.icon class={cn("size-[18px] shrink-0", active ? "text-accent" : "text-muted group-hover:text-ink")} strokeWidth={1.9} />
    <span class="truncate">{t(item.label)}</span>
    {#if badge}
      <span
        class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink"
        title={t("Ein Update ist verfügbar")}>1</span
      >
    {/if}
  </a>
{/snippet}

{#snippet sidebar()}
  <div class="flex h-full flex-col">
    <a href="/" class="flex items-center gap-2.5 px-5 pt-5 pb-4">
      <span class="flex size-8.5 items-center justify-center rounded-[10px] bg-accent text-accent-ink shadow-sm">
        <Shield class="size-[18px]" strokeWidth={2.3} />
      </span>
      <span class="leading-tight">
        <span class="block text-[15px] font-semibold tracking-tight text-ink">Achilles</span>
        <span class="block text-[11px] font-medium text-muted">Financials</span>
      </span>
    </a>

    <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-2">
      {#each GROUPS as g (g.label)}
        <div class="space-y-0.5">
          {#if g.label}
            <div class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{t(g.label)}</div>
          {/if}
          {#each g.items as item (item.href)}
            {@render navLink(item)}
          {/each}
        </div>
      {/each}
    </nav>

    <div class="space-y-0.5 border-t border-line px-3 py-3">
      {#each FOOT as item (item.href)}
        {@render navLink(item, item.href === "/settings" && updateAvailable)}
      {/each}
      {#if authEnabled}
        <button
          type="button"
          onclick={logout}
          class="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <LogOut class="size-[18px] text-muted group-hover:text-ink" strokeWidth={1.9} />
          {t("Abmelden")}
        </button>
      {/if}
    </div>

    <div class="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
      <span class="text-[11px] text-faint">{t("Darstellung")}</span>
      <div class="flex gap-0.5 rounded-lg bg-surface-3 p-0.5">
        {#each THEMES as th (th.value)}
          <button
            type="button"
            title={t(th.label)}
            aria-label={t(th.label)}
            aria-pressed={prefs.theme === th.value}
            onclick={() => setTheme(th.value)}
            class={cn(
              "flex size-6.5 cursor-pointer items-center justify-center rounded-md transition-colors",
              prefs.theme === th.value ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-faint hover:text-ink"
            )}
          >
            <th.icon class="size-3.5" />
          </button>
        {/each}
      </div>
    </div>
  </div>
{/snippet}

<div class="min-h-screen lg:pl-[248px]">
  <!-- Desktop sidebar -->
  <aside class="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-line bg-surface lg:block">
    {@render sidebar()}
  </aside>

  <!-- Mobile top bar -->
  <div class="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur-md lg:hidden" style="padding-top: env(safe-area-inset-top)">
    <a href="/" class="flex items-center gap-2">
      <span class="flex size-7.5 items-center justify-center rounded-lg bg-accent text-accent-ink">
        <Shield class="size-4" strokeWidth={2.3} />
      </span>
      <span class="text-[15px] font-semibold tracking-tight">Achilles</span>
    </a>
    <button
      type="button"
      class="relative -mr-2 rounded-lg p-2 text-ink-2 hover:bg-surface-3"
      onclick={() => (drawer = true)}
      aria-label={t("Menü öffnen")}
    >
      <Menu class="size-5" />
      {#if updateAvailable}<span class="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent"></span>{/if}
    </button>
  </div>

  <!-- Mobile drawer -->
  {#if drawer}
    <div class="fixed inset-0 z-50 lg:hidden">
      <button type="button" class="absolute inset-0 bg-[rgb(15_20_30/0.45)]" aria-label={t("Menü schließen")} onclick={() => (drawer = false)}></button>
      <aside class="rise absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-line bg-surface shadow-[var(--shadow-pop)]">
        <button
          type="button"
          class="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-surface-3"
          onclick={() => (drawer = false)}
          aria-label={t("Menü schließen")}
        >
          <X class="size-4.5" />
        </button>
        {@render sidebar()}
      </aside>
    </div>
  {/if}

  <main class="min-w-0 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-14">
    <!-- Full window width on every page: the grids reflow by breakpoint, so a
         wide screen shows more side by side instead of empty margins. -->
    <div class="w-full">
      {@render children()}
    </div>
  </main>

  <!-- Mobile bottom tabs -->
  <nav class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden" style="padding-bottom: env(safe-area-inset-bottom)">
    {#each TABS as tab (tab.href)}
      {@const active = isActive(tab.href)}
      <a href={tab.href} class={cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium", active ? "text-accent" : "text-muted")}>
        <tab.icon class="size-5" strokeWidth={active ? 2.2 : 1.8} />
        <span class="max-w-full truncate px-1">{t(tab.label)}</span>
      </a>
    {/each}
    <button type="button" onclick={() => (drawer = true)} class="relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted">
      <Menu class="size-5" strokeWidth={1.8} />
      <span>{t("Mehr")}</span>
      {#if updateAvailable}<span class="absolute right-[30%] top-1.5 size-2 rounded-full bg-accent"></span>{/if}
    </button>
  </nav>
</div>
