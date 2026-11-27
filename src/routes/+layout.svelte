<script lang="ts">
  import '#lib/styles/app.css';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { applyStoredAppearance } from '#lib/theme.js';
  import { watchDisplayMode } from '#lib/shell/display-mode.js';
  import Shell from '#lib/shell/Shell.svelte';

  let { children }: { children: Snippet } = $props();

  // Before the first render, so the stored appearance and the band apply without a flash.
  applyStoredAppearance();
  const stopWatching = watchDisplayMode();
  onMount(() => stopWatching);
</script>

<Shell>
  {#snippet header()}
    <span>this machine</span>
  {/snippet}
  {@render children()}
</Shell>
