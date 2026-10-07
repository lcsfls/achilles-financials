<script lang="ts">
  import { LogIn } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import AuthFrame from "$lib/components/AuthFrame.svelte";
  import { t } from "$lib/i18n";

  let username = $state("");
  let password = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    busy = false;
    if (!res.ok) {
      // The lockout message carries an {n} placeholder — without the seconds
      // it would appear on screen literally.
      const d = await res.json();
      error = t(d.error, d.seconds !== undefined ? { n: d.seconds } : undefined);
      return;
    }
    // Full load, not client navigation: the layout's server data (auth state)
    // must be fetched fresh with the new cookie.
    window.location.href = "/";
  }
</script>

<svelte:head><title>{t("Anmelden")} · Achilles</title></svelte:head>

<AuthFrame>
  <Card class="p-6">
    <form onsubmit={submit} class="space-y-4">
      <Field label={t("Benutzername")}>
        <!-- svelte-ignore a11y_autofocus -->
        <Input autofocus autocomplete="username" bind:value={username} oninput={() => (error = null)} />
      </Field>
      <Field label={t("Passwort")}>
        <Input type="password" autocomplete="current-password" bind:value={password} oninput={() => (error = null)} />
      </Field>
      {#if error}<Alert tone="neg">{error}</Alert>{/if}
      <Button type="submit" class="w-full" disabled={busy || !username || !password}>
        <LogIn /> {busy ? t("Anmelden …") : t("Anmelden")}
      </Button>
    </form>
  </Card>
  <p class="mt-4 text-center text-xs leading-relaxed text-muted">
    {t("Passwort vergessen? Es lässt sich nur direkt in der Datenbank zurücksetzen — siehe README.")}
  </p>
</AuthFrame>
