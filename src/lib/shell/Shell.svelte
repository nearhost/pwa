<script lang="ts">
  // The app's frame: a keep-clear band at the top (app.css sets its height), the header with the
  // mark, the wordmark and a slot for the machine name, an optional sidebar and the page.
  import type { Snippet } from 'svelte';
  import { resolve } from '$app/paths';
  import { appName } from '#lib';
  import Mark from './Mark.svelte';

  let { header, sidebar, children }: { header: Snippet; sidebar?: Snippet; children: Snippet } =
    $props();
</script>

<div class="shell" data-shell>
  <!-- The status bar's area. The header's background runs up under it; nothing tappable goes here. -->
  <div class="band" data-shell-band aria-hidden="true"></div>

  <header>
    <h1 class="brand">
      <a href={resolve('/')}>
        <Mark size={22} />
        <span class="wordmark">{appName}</span>
      </a>
    </h1>
    <div class="machine">{@render header()}</div>
  </header>

  <div class="body" class:with-sidebar={!!sidebar}>
    {#if sidebar}
      <nav class="sidebar">{@render sidebar()}</nav>
    {/if}
    <main>
      {@render children()}
    </main>
  </div>
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
    min-height: 52px;
    padding: 0 var(--nh-gutter);
    background: var(--nh-surface);
    border-bottom: 1px solid var(--nh-line);
  }

  .brand {
    margin: 0;
    font: inherit;
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
    width: 280px;
    border-right: 1px solid var(--nh-line);
    background: var(--nh-surface);
  }

  main {
    flex: 1;
    min-width: 0;
    padding: var(--nh-gutter);
  }
</style>
