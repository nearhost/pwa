<script lang="ts">
  // The sidebar on a wide screen: the machine, the app's sections with what waits and the number
  // of documents, the machines the projects run on, and who this device is paired as.
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import Icon from '#lib/ui/Icon.svelte';
  import { appState } from '#lib/state.svelte.js';
  import { documentCount, groupByMachine, waitingCount } from './model.js';

  const machine = $derived(appState.session?.machine || 'This machine');
  const waiting = $derived(waitingCount(appState.state));
  const documents = $derived(documentCount(appState.state));
  const groups = $derived(appState.state ? groupByMachine(appState.state, machine) : []);
  const servers = $derived.by(() => {
    const names = Object.keys(appState.state?.servers ?? {});
    for (const g of groups) if (!g.local && !names.includes(g.key)) names.push(g.key);
    return names.sort().map((name) => ({
      name,
      count: groups.find((g) => g.key === name)?.projects.length ?? 0,
      status: appState.state?.servers?.[name]?.status,
    }));
  });
  const localCount = $derived(groups.find((g) => g.local)?.projects.length ?? 0);
  const path = $derived(page.url.pathname);
  const current = (href: string) => (path === href ? 'page' : undefined);
</script>

<div class="sidebar">
  <div class="machine">
    <span class="dot" data-link={appState.connection}></span>
    <span class="who">
      <span class="name">{machine}</span>
      <span class="host">{page.url.host}</span>
    </span>
  </div>

  <div class="links">
    <a href={resolve('/')} aria-current={current('/')}>
      <Icon name="overview" stroke={path === '/' ? 2 : 1.5} />Overview
    </a>
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve's path with a fragment -->
    <a href={resolve('/') + '#waiting'}>
      <Icon name="waiting" /><span class="grow">Waiting for you</span>
      {#if waiting > 0}<span class="badge">{waiting}</span>{/if}
    </a>
    <a href={resolve('/documents')} aria-current={current('/documents')}>
      <Icon name="document" stroke={path === '/documents' ? 2 : 1.5} /><span class="grow">
        Documents
      </span>
      {#if documents > 0}<span class="count">{documents}</span>{/if}
    </a>
    <a href={resolve('/machine')} aria-current={current('/machine')}>
      <Icon name="device" stroke={path === '/machine' ? 2 : 1.5} />This machine
    </a>
  </div>

  {#if appState.state}
    <h2>Machines</h2>
    <div class="links">
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve's path with a fragment -->
      <a href={resolve('/') + '#machine-local'}>
        <span class="dot" data-status="connected"></span><span class="grow">{machine}</span>
        <span class="count">{localCount}</span>
      </a>
      <!-- eslint-disable svelte/no-navigation-without-resolve -- resolve's path with a fragment -->
      {#each servers as server (server.name)}
        <a
          href={resolve('/') + `#machine-${server.name}`}
          class:quiet={server.status !== 'connected'}
        >
          <span class="dot" data-status={server.status}></span>
          <span class="grow">
            {server.name}
            <span class="via">
              {server.status === 'connected' ? 'via SSH' : (server.status ?? 'not connected')}
            </span>
          </span>
          {#if server.count > 0}<span class="count">{server.count}</span>{/if}
        </a>
      {/each}
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </div>
  {/if}

  <div class="foot">
    {#if appState.session?.device}Paired as <span class="device">{appState.session.device}</span><br
      />{/if}
    {#if appState.state?.info?.version}Nearhost {appState.state.info.version}{/if}
  </div>
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding: 16px 16px 20px;
  }

  .machine {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 8px 12px;
    border-radius: var(--nh-radius-m);
    border: 1px solid var(--nh-line);
    background: var(--nh-ground);
  }

  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    color: var(--nh-text);
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .host {
    color: var(--nh-muted);
    font-family: var(--nh-font-mono);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--nh-muted);
  }

  .dot[data-link='live'],
  .dot[data-status='connected'] {
    border: 0;
    background: var(--pwa-running);
  }

  .dot[data-link='connecting'],
  .dot[data-status='connecting'],
  .dot[data-status='reconnecting'] {
    border: 0;
    background: var(--pwa-starting);
  }

  .dot[data-link='lost'],
  .dot[data-status='auth failed'] {
    border: 0;
    background: var(--pwa-failed);
  }

  .links {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 22px;
  }

  h2 + .links {
    margin-top: 2px;
  }

  .links a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: var(--nh-radius-m);
    color: var(--nh-text);
    text-decoration: none;
    transition: background-color 150ms ease-out;
  }

  .links a:hover {
    background: var(--nh-raised);
  }

  .links a[aria-current='page'] {
    background: var(--nh-raised);
    font-weight: 600;
  }

  .links a:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: -2px;
  }

  .links a.quiet {
    color: var(--nh-muted);
  }

  .grow {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .via {
    color: var(--nh-muted);
    font-size: 13px;
  }

  .badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--pwa-starting);
    color: var(--pwa-on-warn);
    font-size: 12px;
    font-weight: 600;
  }

  .count {
    color: var(--nh-muted);
    font-size: 13px;
  }

  h2 {
    margin: 20px 0 0 12px;
    color: var(--nh-muted);
    font-size: 13px;
    font-weight: 500;
    line-height: 44px;
  }

  .foot {
    margin-top: auto;
    padding: 14px 12px 0;
    border-top: 1px solid var(--nh-line);
    color: var(--nh-muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .foot:empty {
    display: none;
  }

  .device {
    color: var(--nh-text);
  }
</style>
