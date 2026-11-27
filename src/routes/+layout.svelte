<script lang="ts">
  import '#lib/styles/app.css';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { applyStoredAppearance } from '#lib/theme.js';
  import { watchDisplayMode } from '#lib/shell/display-mode.js';
  import Shell from '#lib/shell/Shell.svelte';
  import { createClient } from '#lib/api/client.js';
  import { appState, startState } from '#lib/state.svelte.js';
  import { startLogs } from '#lib/preview/logs.svelte.js';
  import { page } from '$app/state';
  import Sidebar from '#lib/overview/Sidebar.svelte';
  import SectionTabs from '#lib/overview/SectionTabs.svelte';

  let { children }: { children: Snippet } = $props();

  // Before the first render, so the stored appearance and the band apply without a flash.
  applyStoredAppearance();
  const stopWatching = watchDisplayMode();
  onMount(() => {
    const stopLogs = startLogs();
    const stopState = startState(createClient());
    return () => {
      stopState();
      stopLogs();
      stopWatching();
    };
  });

  // A preview and the reader fill the space below the header with their frame.
  const fill = $derived(
    page.route.id === '/projects/[name]' || page.route.id === '/documents/[...path]',
  );
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

<!-- A preview or a document fills the space below the header with its frame; every other page has the sections. -->
{#snippet sidebar()}<Sidebar />{/snippet}
{#snippet tabs()}<SectionTabs />{/snippet}
<Shell {fill} sidebar={fill ? undefined : sidebar} tabs={fill ? undefined : tabs}>
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
    /* The web app's tokens: readable on the header in both schemes (5.3:1 and more). */
    color: var(--pwa-running);
  }

  .connection[data-connection='lost'] {
    color: var(--pwa-failed);
  }
</style>
