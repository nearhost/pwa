<script lang="ts">
  // A project's state as a dot: filled in its colour, hollow when stopped.
  import type { EngineState } from '#lib/overview/model.js';

  let { state, size = 8 }: { state: EngineState; size?: number } = $props();
</script>

<span class="dot" data-state={state} style:--size="{size}px" aria-hidden="true"></span>

<style>
  .dot {
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--nh-muted);
  }

  .dot[data-state='running'] {
    background: var(--pwa-running);
  }

  .dot[data-state='starting'],
  .dot[data-state='degraded'] {
    background: var(--pwa-starting);
  }

  .dot[data-state='error'] {
    background: var(--pwa-failed);
  }

  .dot[data-state='stopped'] {
    background: none;
    border: 1.5px solid var(--nh-muted);
  }
</style>
