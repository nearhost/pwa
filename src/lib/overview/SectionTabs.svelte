<script lang="ts">
  // The app's sections as a bar at the bottom, where the screen is too narrow for the sidebar.
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import Icon from '#lib/ui/Icon.svelte';
  import { appState } from '#lib/state.svelte.js';
  import { waitingCount } from './model.js';

  const waiting = $derived(waitingCount(appState.state));
  const path = $derived(page.url.pathname);
</script>

<div class="tabs">
  <a href={resolve('/')} aria-current={path === '/' ? 'page' : undefined}>
    <Icon name="overview" size={24} stroke={path === '/' ? 2 : 1.5} />Overview
  </a>
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve's path with a fragment -->
  <a href={resolve('/') + '#waiting'}>
    <Icon name="waiting" size={24} />Waiting
    {#if waiting > 0}<span class="badge">{waiting}</span>{/if}
  </a>
  <a href={resolve('/documents')} aria-current={path === '/documents' ? 'page' : undefined}>
    <Icon name="document" size={24} stroke={path === '/documents' ? 2 : 1.5} />Documents
  </a>
  <a href={resolve('/machine')} aria-current={path === '/machine' ? 'page' : undefined}>
    <Icon name="device" size={24} stroke={path === '/machine' ? 2 : 1.5} />Machine
  </a>
</div>

<style>
  .tabs {
    display: flex;
    padding: 6px 8px var(--pwa-inset-bottom);
  }

  a {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-height: 48px;
    padding-top: 6px;
    color: var(--nh-muted);
    font-size: 11px;
    text-decoration: none;
  }

  a[aria-current='page'] {
    color: var(--nh-accent);
    font-weight: 600;
  }

  a:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: -2px;
    border-radius: var(--nh-radius-m);
  }

  .badge {
    position: absolute;
    top: 2px;
    left: 54%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--pwa-starting);
    color: var(--pwa-on-warn);
    font-size: 11px;
    font-weight: 600;
  }
</style>
