<script lang="ts">
  // The overview: what waits for the user, then every project grouped by the machine it runs on,
  // with search; the empty state when nothing is served yet.
  import { page } from '$app/state';
  import { appState } from '#lib/state.svelte.js';
  import ConnectionNotice from '#lib/shell/ConnectionNotice.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import EmptyOverview from '#lib/overview/EmptyOverview.svelte';
  import MachineGroup from '#lib/overview/MachineGroup.svelte';
  import { filterGroups, groupByMachine } from '#lib/overview/model.js';
  import WaitingList from '#lib/approvals/WaitingList.svelte';

  let query = $state('');

  const machine = $derived(appState.session?.machine || 'this machine');
  const networked = $derived(appState.session?.networked ?? false);
  const live = $derived(appState.connection === 'live');
  const groups = $derived(appState.state ? groupByMachine(appState.state, machine) : []);
  const shown = $derived(filterGroups(groups, query));
  // An example address for the empty state, under the network's domain when the page is on it.
  const example = $derived(
    page.url.hostname.startsWith('nearhost.')
      ? `storefront.${page.url.hostname.slice('nearhost.'.length)}`
      : 'storefront.test',
  );
</script>

<div class="overview">
  <div class="top">
    <h1>Overview</h1>
    {#if groups.length > 0}
      <label class="search">
        <Icon name="search" size={18} />
        <span class="visually-hidden">Filter projects</span>
        <input type="search" placeholder="Filter by name" bind:value={query} />
      </label>
      <span class="add">
        <button type="button" disabled aria-describedby="add-project-soon">
          <Icon name="plus" size={18} stroke={2} />Add project
        </button>
        <span class="soon" id="add-project-soon">Coming soon</span>
      </span>
    {/if}
  </div>

  <ConnectionNotice />

  <WaitingList />

  {#if !appState.state}
    <p class="quiet" role="status">
      {appState.connection === 'signed-out' ? '' : `Connecting to ${machine}…`}
    </p>
  {:else if groups.length === 0}
    <EmptyOverview {machine} {example} />
  {:else if shown.length === 0}
    <p class="quiet">No project matches “{query.trim()}”.</p>
  {:else}
    {#each shown as group (group.key)}
      <MachineGroup
        {group}
        {machine}
        serverStatus={group.local ? undefined : appState.state.servers?.[group.key]?.status}
        {networked}
        {live}
      />
    {/each}
  {/if}
</div>

<style>
  .overview {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100%;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
  }

  h1 {
    flex: 1;
    margin: 0;
    font-size: 30px;
    letter-spacing: -0.02em;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 260px;
    height: 44px;
    padding: 0 14px;
    border-radius: var(--nh-radius-m);
    background: var(--nh-surface);
    border: 1px solid var(--nh-line);
    color: var(--nh-muted);
  }

  .search:focus-within {
    border-color: var(--nh-accent);
  }

  .search:has(input:focus-visible) {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--nh-text);
    font: inherit;
    outline: none;
  }

  .add {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .add button {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--nh-radius-m);
    background: var(--nh-accent);
    color: var(--pwa-accent-ink);
    font: inherit;
    font-weight: 600;
  }

  .add button:disabled {
    opacity: 0.5;
  }

  .soon {
    color: var(--nh-muted);
    font-size: 12px;
  }

  .quiet {
    margin: 0;
    color: var(--nh-muted);
  }

  @media (max-width: 599px) {
    .overview {
      gap: 14px;
    }

    h1 {
      font-size: 24px;
    }

    .search {
      order: 3;
      width: 100%;
    }
  }
</style>
