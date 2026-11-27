<script lang="ts">
  import '#lib/styles/app.css';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { applyStoredAppearance } from '#lib/theme.js';
  import { watchDisplayMode } from '#lib/shell/display-mode.js';
  import Shell from '#lib/shell/Shell.svelte';
  import { createClient } from '#lib/api/client.js';
  import { appState, startState } from '#lib/state.svelte.js';

  let { children }: { children: Snippet } = $props();

  // Before the first render, so the stored appearance and the band apply without a flash.
  applyStoredAppearance();
  const stopWatching = watchDisplayMode();
  onMount(() => {
    const stopState = startState(createClient());
    return () => {
      stopState();
      stopWatching();
    };
  });

  const machine = $derived(appState.session?.machine || 'this machine');
  const line = $derived(
    {
      live: 'Live',
      connecting: 'Connecting…',
      lost: `Can't reach ${machine}`,
      'signed-out': 'Not paired',
    }[appState.connection],
  );
</script>

<Shell>
  {#snippet header()}
    <span class="machine-name" data-machine>{machine}</span>
    <span class="connection" data-connection={appState.connection} role="status">{line}</span>
  {/snippet}
  {@render children()}
</Shell>

<style>
  .machine-name {
    color: var(--nh-text);
  }

  .connection {
    margin-left: 10px;
    font-size: 14px;
  }

  .connection[data-connection='live'] {
    color: var(--nh-running);
  }

  .connection[data-connection='lost'] {
    color: var(--nh-failed);
  }
</style>
