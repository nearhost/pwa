<script lang="ts">
  // Why a screen's actions are off and how old its data is, whenever the connection isn't live.
  // Buttons point at it with aria-describedby="connection-reason".
  import { connectionReason } from '#lib/connection.js';
  import { appState } from '#lib/state.svelte.js';

  /** What waits for the connection, in lower case, such as "answering". */
  let { waits }: { waits?: string } = $props();

  const reason = $derived(
    connectionReason(
      appState.connection,
      appState.session?.machine || 'this machine',
      appState.lastAnswered,
      waits,
    ),
  );
</script>

{#if reason}
  <p class="notice" id="connection-reason" data-connection-notice>{reason}</p>
{/if}

<style>
  .notice {
    margin: 0;
    padding: 12px 16px;
    border-radius: var(--nh-radius-l);
    background: var(--pwa-warn-bg);
    border: 1px solid var(--pwa-warn-line);
    color: var(--pwa-warn-body);
    font-size: 14px;
    line-height: 1.45;
  }
</style>
