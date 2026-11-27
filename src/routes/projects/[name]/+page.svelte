<script lang="ts">
  // A project's preview: its page in a frame on the chosen route, at a chosen width, with Reload
  // and Open in browser. While it starts, its routes and log; stopped, a way to start it.
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { appState } from '#lib/state.svelte.js';
  import ConnectionNotice from '#lib/shell/ConnectionNotice.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import StartStop from '#lib/ui/StartStop.svelte';
  import { addressOf, stateLabel } from '#lib/overview/model.js';
  import { actionError } from '#lib/overview/actions.svelte.js';
  import { projectLogs } from '#lib/preview/logs.svelte.js';
  import { frameWidths, isCrossSite, type FrameWidth } from '#lib/preview/model.js';
  import PreviewFrame from '#lib/preview/PreviewFrame.svelte';
  import RouteTabs from '#lib/preview/RouteTabs.svelte';
  import StartingPanel from '#lib/preview/StartingPanel.svelte';
  import WidthControl from '#lib/preview/WidthControl.svelte';

  const name = $derived(page.params.name ?? '');
  const machine = $derived(appState.session?.machine || 'this machine');
  const networked = $derived(appState.session?.networked ?? false);
  const live = $derived(appState.connection === 'live');
  const status = $derived(appState.state?.projects?.[name]);
  const site = $derived(appState.state?.sites?.[name]);
  const routes = $derived(site?.routes ?? []);
  const where = $derived(site?.server || machine);

  let selected = $state(0);
  let width = $state<FrameWidth>('fill');
  let reload = $state(0);

  // Another project starts on its primary route.
  $effect(() => {
    void name;
    selected = 0;
  });

  const route = $derived(routes[Math.min(selected, routes.length - 1)]);
  const address = $derived(addressOf(route, networked));
  const crossSite = $derived(address ? isCrossSite(address, page.url.hostname) : false);
  const framed = $derived(status?.State === 'running' || status?.State === 'degraded');
  const error = $derived(status ? actionError(name, status.State) : undefined);
</script>

<div class="preview">
  <div class="chrome">
    <div class="controls">
      <a class="back" href={resolve('/')} aria-label="Back to overview">
        <Icon name="back" size={22} stroke={2} />
      </a>
      <div class="title">
        <h1>{name}</h1>
        {#if status}<span class="sub">{where} · {stateLabel(status.State)}</span>{/if}
      </div>
      <RouteTabs {routes} bind:selected controls="preview-stage" />
      <span class="grow"></span>
      {#if framed}
        <span class="widths"><WidthControl bind:value={width} /></span>
        <button type="button" class="icon-button" aria-label="Reload" onclick={() => (reload += 1)}>
          <Icon name="reload" size={20} stroke={2} />
        </button>
      {/if}
      {#if address}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a project's own address, not the app's -->
        <a class="open" href={address} target="_blank" rel="noopener">
          <Icon name="external" size={18} stroke={2} />Open in browser
        </a>
      {/if}
    </div>
    {#if address}
      <div class="address">
        <span class="lock"><Icon name="lock" size={14} stroke={2} /></span>
        <span class="url">{address}</span>
        <span class="grow"></span>
        <span class="hint">Logins and file uploads work better in your browser.</span>
      </div>
    {/if}
  </div>

  <div class="stage" id="preview-stage">
    <ConnectionNotice />
    {#if !appState.state}
      <p class="quiet" role="status">
        {appState.connection === 'signed-out' ? '' : `Connecting to ${machine}…`}
      </p>
    {:else if !status}
      <div class="panel">
        <p>There is no project called {name} on {machine}.</p>
        <a class="text-link" href={resolve('/')}>Go to the overview</a>
      </div>
    {:else if status.State === 'starting'}
      <StartingPanel {name} message={status.Message} {routes} lines={projectLogs.lines(name)} />
    {:else if !framed}
      <div class="panel">
        <h2>{status.State === 'stopped' ? `${name} is stopped` : `${name} isn't running`}</h2>
        {#if status.Message}<p>{status.Message}</p>{/if}
        <span class="start">
          <StartStop {name} state={status.State} running={false} {live} label />
        </span>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      </div>
    {:else if !address}
      <div class="panel"><p>{name} has no web route to show.</p></div>
    {:else}
      <PreviewFrame
        {name}
        src={address}
        width={frameWidths.find((w) => w.id === width)?.width}
        {reload}
        {crossSite}
      />
    {/if}
  </div>
</div>

<style>
  .preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .chrome {
    flex: none;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 8px 16px;
    background: var(--nh-surface);
    border-bottom: 1px solid var(--nh-line);
  }

  .back,
  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--nh-radius-m);
    color: var(--nh-text);
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  .icon-button {
    border: 1px solid var(--nh-line);
    background: none;
    cursor: pointer;
  }

  .back:hover,
  .icon-button:hover {
    background: var(--nh-raised);
  }

  .back:active,
  .icon-button:active,
  .open:active {
    transform: scale(0.96);
  }

  .title {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 220px;
    margin-right: 4px;
  }

  h1 {
    margin: 0;
    font-family: var(--nh-font-body);
    font-size: 16px;
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    color: var(--nh-muted);
    font-size: 12px;
    white-space: nowrap;
  }

  .grow {
    flex: 1;
  }

  .open {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 16px;
    border-radius: var(--nh-radius-m);
    background: var(--nh-accent);
    color: var(--nh-accent-ink);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: transform 150ms ease-out;
  }

  .back:focus-visible,
  .icon-button:focus-visible,
  .open:focus-visible,
  .text-link:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  .address {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
    padding: 0 20px;
    color: var(--nh-muted);
    font-size: 13px;
  }

  .lock {
    color: var(--pwa-running);
  }

  .url {
    min-width: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding: 0 12px calc(var(--pwa-inset-bottom) + 12px);
  }

  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 24px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    text-align: center;
  }

  .panel h2 {
    margin: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-display);
    font-size: 24px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .panel p {
    margin: 0;
    max-width: 500px;
    color: var(--nh-body);
    overflow-wrap: anywhere;
  }

  .panel .error {
    color: var(--pwa-failed);
  }

  .start {
    display: flex;
    width: 200px;
  }

  .text-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    color: var(--nh-text);
    text-underline-offset: 3px;
    text-decoration-color: var(--nh-muted);
  }

  .quiet {
    margin: 0;
    padding: 12px 8px;
    color: var(--nh-muted);
  }

  /* An iPad in portrait: the routes go to a line of their own. */
  @media (max-width: 1023px) {
    .controls {
      flex-wrap: wrap;
    }

    .controls > :global(.tabs) {
      order: 10;
      flex-basis: 100%;
    }

    .hint {
      display: none;
    }
  }

  /* A phone: the frame fills the screen and the controls sit at the bottom, in reach. */
  @media (max-width: 599px) {
    .chrome {
      order: 2;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px var(--pwa-inset-bottom);
      background: var(--nh-surface);
      border-top: 1px solid var(--nh-line);
    }

    .controls {
      flex-wrap: nowrap;
      justify-content: space-between;
      gap: 4px;
      min-height: 0;
      padding: 0;
      border: 0;
    }

    .title {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .grow,
    .widths {
      display: none;
    }

    .icon-button {
      border: 0;
    }

    .controls > :global(.select) {
      flex: 1;
      min-width: 0;
    }

    .open {
      padding: 0 12px;
      gap: 6px;
      font-size: 14px;
    }

    .address {
      order: -1;
      height: 40px;
      min-height: 0;
      padding: 0 12px;
      border-radius: var(--nh-radius-m);
      background: var(--nh-ground);
      border: 1px solid var(--nh-line);
    }

    .stage {
      order: 1;
      padding: 0;
    }

    .stage > :global(.notice),
    .stage > .quiet {
      margin: 12px 12px 0;
    }

    .panel {
      border-radius: 0;
      box-shadow: none;
    }

    .stage > :global(.starting) {
      padding: 12px 20px 16px;
    }
  }
</style>
