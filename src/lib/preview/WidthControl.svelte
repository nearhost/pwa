<script lang="ts">
  // The frame's width: the whole area, an iPad's, or a phone's.
  import Icon from '#lib/ui/Icon.svelte';
  import { frameWidths, type FrameWidth } from './model.js';

  let { value = $bindable() }: { value: FrameWidth } = $props();
</script>

<div class="segmented" role="radiogroup" aria-label="Frame width">
  {#each frameWidths as w (w.id)}
    <button
      type="button"
      role="radio"
      aria-checked={value === w.id}
      aria-label={w.label}
      onclick={() => (value = w.id)}
    >
      <Icon name={w.id} size={20} />
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-ground);
    border: 1px solid var(--nh-line);
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 36px;
    border: 0;
    border-radius: var(--nh-radius-m);
    background: none;
    color: var(--nh-muted);
    cursor: pointer;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  button[aria-checked='true'] {
    background: var(--nh-line);
    color: var(--nh-text);
  }

  button:active {
    transform: scale(0.96);
  }

  button:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 1px;
  }
</style>
