<script lang="ts">
  import { linear, monotonePath } from "./scale";

  let {
    values,
    width = 96,
    height = 28,
    color,
  }: { values: number[]; width?: number; height?: number; color?: string } = $props();

  const stroke = $derived(color ?? (values.length > 1 && values[values.length - 1] < values[0] ? "var(--neg)" : "var(--pos)"));
  const d = $derived.by(() => {
    if (values.length < 2) return "";
    const lo = Math.min(...values), hi = Math.max(...values);
    const x = linear(0, values.length - 1, 1, width - 1);
    const y = linear(lo, hi === lo ? lo + 1 : hi, height - 2, 2);
    return monotonePath(values.map((v, i) => [x(i), y(v)]));
  });
</script>

<svg {width} {height} class="overflow-visible" aria-hidden="true">
  {#if d}<path {d} fill="none" stroke={stroke} stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />{/if}
</svg>
