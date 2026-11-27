<script lang="ts">
  // A project's start or stop button. Both icons are in it and cross-fade when the project's
  // state turns it from one to the other. Busy while the ask is out; off with the connection.
  import Icon from './Icon.svelte';
  import { projectActions, startStop } from '#lib/overview/actions.svelte.js';

  let {
    name,
    running,
    live,
    label = false,
  }: {
    name: string;
    /** Stop when true, start when false. */
    running: boolean;
    live: boolean;
    /** Show "Start" as text beside the icon when starting. */
    label?: boolean;
  } = $props();

  const busy = $derived(!!projectActions.pending[name]);
</script>

<button
  type="button"
  class="start-stop"
  class:with-label={label && !running}
  data-mode={running ? 'stop' : 'start'}
  aria-label={`${running ? 'Stop' : 'Start'} ${name}`}
  aria-busy={busy}
  aria-describedby={live ? undefined : 'connection-reason'}
  disabled={!live || busy}
  onclick={() => startStop(name, running ? 'stop' : 'start')}
>
  <span class="icons">
    <span class="icon start"><Icon name="start" size={16} /></span>
    <span class="icon stop"><Icon name="stop" size={16} /></span>
  </span>
  {#if label && !running}<span class="text">Start</span>{/if}
</button>

<style>
  .start-stop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 44px;
    height: 44px;
    padding: 0 12px;
    border-radius: var(--nh-radius-m);
    border: 1px solid var(--nh-line);
    background: none;
    color: var(--nh-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  .start-stop:not(.with-label) {
    width: 44px;
    padding: 0;
  }

  .start-stop.with-label {
    flex: 1;
  }

  @media (max-width: 599px) {
    .start-stop.with-label {
      flex: none;
      height: 36px;
      padding: 0 14px;
      font-size: 14px;
    }

    .start-stop:not(.with-label) {
      border: 0;
    }
  }

  .start-stop:hover:not(:disabled) {
    background: var(--nh-raised);
  }

  .start-stop:active:not(:disabled) {
    transform: scale(0.96);
  }

  .start-stop:disabled {
    cursor: default;
    color: var(--nh-muted);
  }

  .start-stop[aria-busy='true'] {
    cursor: progress;
  }

  .start-stop:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  .icons {
    position: relative;
    width: 16px;
    height: 16px;
  }

  .icon {
    position: absolute;
    inset: 0;
    transition:
      transform 200ms cubic-bezier(0.2, 0, 0, 1),
      opacity 200ms cubic-bezier(0.2, 0, 0, 1),
      filter 200ms cubic-bezier(0.2, 0, 0, 1);
  }

  [data-mode='start'] .stop,
  [data-mode='stop'] .start {
    transform: scale(0.25);
    opacity: 0;
    filter: blur(4px);
  }

  @media (prefers-reduced-motion: reduce) {
    .icon {
      transition: none;
    }
  }
</style>
