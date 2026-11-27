<script lang="ts">
  // The project's web routes, the primary first: tabs where there is room, a list to pick from on
  // a phone.
  import type { SiteRoute } from '#lib/overview/model.js';
  import { routeLabel } from './model.js';

  let {
    routes,
    selected = $bindable(),
    controls,
  }: { routes: SiteRoute[]; selected: number; controls: string } = $props();

  const labels = $derived(routes.map((r) => routeLabel(r.host, routes[0]?.host ?? '')));
</script>

{#if routes.length > 1}
  <div class="tabs" role="tablist" aria-label="Routes">
    {#each labels as label, i (routes[i].host)}
      <button
        type="button"
        role="tab"
        aria-selected={selected === i}
        aria-controls={controls}
        tabindex={selected === i ? 0 : -1}
        onclick={() => (selected = i)}
      >
        {label}
      </button>
    {/each}
  </div>
  <label class="select">
    <span class="visually-hidden">Route</span>
    <select bind:value={selected}>
      {#each labels as label, i (routes[i].host)}
        <option value={i}>{label}</option>
      {/each}
    </select>
  </label>
{/if}

<style>
  .tabs {
    display: flex;
    gap: 4px;
    min-width: 0;
    padding: 4px;
    overflow-x: auto;
    border-radius: var(--nh-radius-l);
    background: var(--nh-ground);
    border: 1px solid var(--nh-line);
    scrollbar-width: none;
  }

  [role='tab'] {
    flex: none;
    height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--nh-radius-m);
    background: none;
    color: var(--nh-muted);
    font-family: var(--nh-font-mono);
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  [role='tab'][aria-selected='true'] {
    background: var(--nh-line);
    color: var(--nh-text);
  }

  [role='tab']:active {
    transform: scale(0.96);
  }

  [role='tab']:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 1px;
  }

  .select {
    display: none;
  }

  select {
    width: 100%;
    height: 44px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--nh-radius-m);
    background: none;
    color: var(--nh-text);
    font: inherit;
    font-size: 14px;
  }

  select:focus-visible {
    outline: 2px solid var(--nh-accent);
  }

  @media (max-width: 599px) {
    .tabs {
      display: none;
    }

    .select {
      display: block;
    }
  }
</style>
