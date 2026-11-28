<script lang="ts">
  // What waits for the user, on the overview: each agent's request (oldest first) and each
  // project's change, saying who asks for what and from where, with a link to answer it.
  import { onMount } from 'svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import { appState } from '#lib/state.svelte.js';
  import Said from './Said.svelte';
  import { contextOf, waitingList } from './model.js';

  // How long each asker still waits moves on by itself.
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 15_000);
    return () => clearInterval(timer);
  });

  const machine = $derived(appState.session?.machine || 'this machine');
  const items = $derived(waitingList(appState.state, contextOf(appState.state, machine, now)));
</script>

{#if items.length > 0}
  <section class="waiting" id="waiting" aria-labelledby="waiting-heading">
    <h2 id="waiting-heading" class="visually-hidden">Waiting for you</h2>
    {#each items as item (item.key)}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- waitingList gives the app's own paths; the app is served at the root -->
      <a href={item.href} data-kind={item.kind}>
        <span class="clock"><Icon name="waiting" size={24} stroke={2} /></span>
        <span class="what">
          <span class="headline"><Said segments={item.headline} /></span>
          {#if item.detail.length > 0}
            <span class="detail"><Said segments={item.detail} /></span>
          {/if}
        </span>
        <span class="review">Review</span>
      </a>
    {/each}
  </section>
{/if}

<style>
  .waiting {
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-margin-top: calc(var(--pwa-band) + 80px);
  }

  a {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
    border-radius: var(--nh-radius-l);
    background: var(--pwa-warn-bg);
    border: 1px solid var(--pwa-warn-line);
    color: var(--nh-text);
    text-decoration: none;
    transition: scale 150ms ease-out;
  }

  a:active {
    scale: 0.99;
  }

  a:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  .clock {
    flex: none;
    color: var(--pwa-starting);
  }

  .what {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .headline {
    font-weight: 600;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .detail {
    color: var(--pwa-warn-body);
    font-size: 14px;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .detail :global(.quoted) {
    color: inherit;
  }

  .review {
    flex: none;
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 20px;
    border-radius: var(--nh-radius-m);
    background: var(--pwa-starting);
    color: var(--pwa-on-warn);
    font-weight: 600;
  }

  @media (max-width: 599px) {
    a {
      padding: 14px;
      gap: 12px;
    }

    .review {
      display: none;
    }
  }
</style>
