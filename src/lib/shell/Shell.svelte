<script lang="ts">
  // The app's frame: a keep-clear band at the top (app.css sets its height), the header with the
  // mark, the wordmark and a slot for the machine name, the page, and the app's sections: a
  // sidebar on a wide screen (1024px and up), a bar at the bottom on a narrower one. The brand is a
  // link, not a heading: each route renders its own <h1>. With fill, the page takes exactly the
  // space below the header (a preview's frame) and has no sections beside it.
  import type { Snippet } from 'svelte';
  import { resolve } from '$app/paths';
  import { appName } from '#lib';
  import Mark from './Mark.svelte';

  let {
    header,
    sidebar,
    tabs,
    fill = false,
    children,
  }: {
    header: Snippet;
    sidebar?: Snippet;
    tabs?: Snippet;
    fill?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="shell" class:fill class:with-tabs={!!tabs} data-shell>
  <!-- The status bar's area. The header's background runs up under it; nothing tappable goes here. -->
  <div class="band" data-shell-band aria-hidden="true"></div>

  <header>
    <div class="brand">
      <a href={resolve('/')}>
        <Mark size={22} />
        <span class="wordmark">{appName}</span>
      </a>
    </div>
    <div class="machine">{@render header()}</div>
  </header>

  <div class="body" class:with-sidebar={!!sidebar}>
    {#if sidebar}
      <nav class="sidebar" aria-label="Nearhost">{@render sidebar()}</nav>
    {/if}
    <main>
      {@render children()}
    </main>
  </div>
  {#if tabs}
    <nav class="tabs" aria-label="Sections">{@render tabs()}</nav>
  {/if}
</div>

<style>
  .shell {
    min-height: 100dvh;
    padding-top: var(--pwa-band);
    padding-bottom: var(--pwa-inset-bottom);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    display: flex;
    flex-direction: column;
  }

  .band {
    position: fixed;
    inset: 0 0 auto;
    height: var(--pwa-band);
    background: var(--nh-surface);
    z-index: 2;
  }

  header {
    position: sticky;
    top: var(--pwa-band);
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    /* 64px of content; the border sits below it. */
    box-sizing: content-box;
    height: 64px;
    padding: 0 var(--nh-gutter);
    background: var(--nh-surface);
    border-bottom: 1px solid var(--nh-line);
  }

  .brand {
    flex: none;
  }

  .brand a {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    color: var(--nh-text);
    text-decoration: none;
    border-radius: var(--nh-radius-m);
  }

  .brand a:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  .wordmark {
    font-family: var(--nh-font-display);
    font-weight: 600;
    font-size: 17px;
    letter-spacing: var(--nh-track-display);
  }

  .machine {
    min-width: 0;
    color: var(--nh-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .sidebar {
    flex: none;
    position: sticky;
    /* Below the band and the header with its border. */
    top: calc(var(--pwa-band) + 65px);
    width: 288px;
    height: calc(100dvh - var(--pwa-band) - 65px - var(--pwa-inset-bottom));
    overflow-y: auto;
    border-right: 1px solid var(--nh-line);
    background: var(--nh-surface);
  }

  main {
    flex: 1;
    min-width: 0;
    padding: var(--nh-gutter);
  }

  .tabs {
    position: fixed;
    inset: auto 0 0;
    z-index: 1;
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    background: var(--nh-surface);
    border-top: 1px solid var(--nh-line);
  }

  /* The bar's height (6px, 48px of links, the bottom inset) is kept clear below the page. */
  .with-tabs main {
    padding-bottom: calc(var(--nh-gutter) + 54px + var(--pwa-inset-bottom));
  }

  @media (max-width: 1023px) {
    .sidebar {
      display: none;
    }
  }

  @media (min-width: 1024px) {
    .tabs {
      display: none;
    }

    .with-tabs main {
      padding-bottom: var(--nh-gutter);
    }

    .body.with-sidebar main {
      padding: 32px 36px;
    }
  }

  /* A page that fills the space below the header: no scrolling of its own frame, no insets. */
  .shell.fill {
    height: 100dvh;
    min-height: 0;
    padding-bottom: 0;
  }

  .fill main {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
