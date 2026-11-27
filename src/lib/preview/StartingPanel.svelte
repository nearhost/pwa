<script lang="ts">
  // A project that is starting: what it waits for, each route with its port, and its log as it
  // comes. The frame takes over by itself once the project runs.
  import type { SiteRoute } from '#lib/overview/model.js';
  import { routeLabel } from './model.js';

  let {
    name,
    message,
    routes,
    lines,
  }: { name: string; message: string; routes: SiteRoute[]; lines: string[] } = $props();

  let log = $state<HTMLPreElement>();

  const said = $derived(message ? message.charAt(0).toUpperCase() + message.slice(1) : '');

  $effect(() => {
    // Follow the newest line.
    void lines.length;
    if (log) log.scrollTop = log.scrollHeight;
  });
</script>

<div class="starting">
  <div class="status" role="status">
    <h2><span class="spinner" aria-hidden="true"></span>Starting {name}</h2>
    <p>
      {#if said}{said.replace(/\.?$/, '.')}{/if} The site opens here by itself when it does.
    </p>
  </div>
  {#if routes.length > 0}
    <ul aria-label="Routes">
      {#each routes as route (route.host)}
        <li>
          <span class="ring" aria-hidden="true"></span>
          <span class="host">{routeLabel(route.host, routes[0].host)}</span>
          <span class="waiting">waiting · :{route.port}</span>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="log">
    <h3 id="starting-log">Log</h3>
    <pre bind:this={log} aria-labelledby="starting-log">{lines.length
        ? lines.join('\n')
        : 'Nothing logged yet.'}</pre>
  </div>
</div>

<style>
  .starting {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 720px;
    min-height: 0;
    margin: 0 auto;
    padding-top: 12px;
  }

  .status {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-display);
    font-size: 22px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .spinner {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--pwa-starting);
    border-right-color: transparent;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }

  p {
    margin: 0;
    color: var(--nh-body);
    line-height: 1.5;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    font-size: 14px;
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 14px;
  }

  li + li {
    border-top: 1px solid var(--nh-line);
  }

  .ring {
    flex: none;
    width: 10px;
    height: 10px;
    margin: 0 4px;
    border-radius: 50%;
    border: 1.5px solid var(--pwa-starting);
  }

  .host {
    flex: 1;
    min-width: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-mono);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .waiting {
    color: var(--pwa-starting);
    white-space: nowrap;
  }

  .log {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 120px;
  }

  h3 {
    margin: 0;
    color: var(--nh-muted);
    font-size: 14px;
    font-weight: 500;
  }

  pre {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 12px;
    overflow: auto;
    border-radius: var(--nh-radius-m);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    color: var(--nh-body);
    font-family: var(--nh-font-mono);
    font-size: 11.5px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
