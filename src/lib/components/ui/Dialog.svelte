<script lang="ts">
  import type { Snippet } from "svelte";
  import { X } from "@lucide/svelte";
  import { cn } from "$lib/utils";

  /**
   * Modal on the native <dialog>: focus trap, Escape and the top layer come
   * from the browser, so it stacks above everything without z-index games.
   */
  let {
    open = $bindable(false),
    title,
    description,
    class: klass = "",
    onclose,
    children,
    footer,
    dismissable = true,
  }: {
    open?: boolean;
    title?: string;
    description?: string | null;
    class?: string;
    onclose?: () => void;
    children?: Snippet;
    footer?: Snippet;
    /** false: no Escape, no backdrop click, no close button — for work in progress. */
    dismissable?: boolean;
  } = $props();

  let el: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  });

  function handleClose() {
    open = false;
    onclose?.();
  }
</script>

<dialog
  bind:this={el}
  onclose={handleClose}
  oncancel={(e) => { if (!dismissable) e.preventDefault(); }}
  onclick={(e) => { if (e.target === el && dismissable) el?.close(); }}
  class={cn(
    "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-visible rounded-2xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)]",
    "backdrop:bg-[rgb(15_20_30/0.45)] backdrop:backdrop-blur-[2px]",
    klass
  )}
>
  {#if open}
    <div class="flex max-h-[calc(100dvh-2rem)] flex-col">
      {#if title}
        <div class="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div class="min-w-0">
            <h2 class="text-base font-semibold">{title}</h2>
            {#if description}<p class="mt-0.5 text-[13px] text-muted">{description}</p>{/if}
          </div>
          {#if dismissable}<button
            type="button"
            class="-mr-2 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-ink"
            onclick={() => el?.close()}
            aria-label="Close"
          >
            <X class="size-4" />
          </button>{/if}
        </div>
      {/if}
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {@render children?.()}
      </div>
      {#if footer}
        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-3.5 rounded-b-2xl">
          {@render footer()}
        </div>
      {/if}
    </div>
  {/if}
</dialog>
