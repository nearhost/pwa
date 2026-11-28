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
  import NotPaired from '#lib/shell/NotPaired.svelte';
  import Offline from '#lib/shell/Offline.svelte';
  import { lostLong, readLastSeen, showOffline, writeLastSeen } from '#lib/offline/model.js';

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

  // The machine and when it last answered, as this device last heard: a shell from the cache, with
  // no session read yet, still names the machine. Kept again each minute the core answers in.
  const lastSeen = readLastSeen();
  let keptMinute = 0;
  $effect(() => {
    const at = appState.lastAnswered;
    const name = appState.session?.machine;
    if (!at || !name) return;
    const minute = Math.floor(at.getTime() / 60_000);
    if (minute === keptMinute) return;
    keptMinute = minute;
    writeLastSeen({ machine: name, at });
  });
  const known = $derived(appState.session ? undefined : lastSeen?.machine);
  const lastAnswered = $derived(
    appState.lastAnswered ?? (appState.session ? undefined : lastSeen?.at),
  );

  // The offline view: at once when the core hasn't answered since the app loaded, after lostLong of
  // a lost connection otherwise. tick re-reads the clock when that time comes.
  let tick = $state(0);
  $effect(() => {
    const since = appState.lostSince;
    if (!since) return;
    const wait = since.getTime() + lostLong - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(() => tick++, wait);
    return () => clearTimeout(timer);
  });
  const offline = $derived.by(() => {
    void tick;
    return showOffline({
      connection: appState.connection,
      lostSince: appState.lostSince?.getTime(),
      answered: !!appState.lastAnswered,
      now: Date.now(),
    });
  });

  // Not paired, every route shows how to pair instead.
  const signedOut = $derived(appState.connection === 'signed-out');
  // A preview and the reader fill the space below the header with their frame.
  const fill = $derived(
    !signedOut &&
      !offline &&
      (page.route.id === '/projects/[name]' || page.route.id === '/documents/[...path]'),
  );
  const machine = $derived(appState.session?.machine || known || 'this machine');
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
{#snippet sidebar()}<Sidebar {known} dimmed={offline} />{/snippet}
{#snippet tabs()}<SectionTabs />{/snippet}
<Shell {fill} sidebar={fill ? undefined : sidebar} tabs={fill ? undefined : tabs}>
  {#snippet header()}
    <span class="machine-name" data-machine>{machine}</span>
    <span class="connection" data-connection={appState.connection} role="status">{line}</span>
  {/snippet}
  {#if signedOut}
    <NotPaired />
  {:else if offline}
    <Offline {machine} {lastAnswered} />
  {:else}
    {@render children()}
  {/if}
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
