<script lang="ts">
  // A project's change request: what its .nearhostrc asks for that needs approval, why each item
  // does, and what is served now against what the change serves, with Approve and Decline sent
  // with the change's SHA-256. It follows the state: a change answered elsewhere says it is no
  // longer waiting; one the file replaced while open says so and shows the new one.
  import { untrack } from 'svelte';
  import { resolve } from '$app/paths';
  import ConnectionNotice from '#lib/shell/ConnectionNotice.svelte';
  import { apiClient, appState } from '#lib/state.svelte.js';
  import { Answering } from './answer.svelte.js';
  import RequestCard from './RequestCard.svelte';
  import { changeView } from './model.js';

  let { name }: { name: string } = $props();

  const machine = $derived(appState.session?.machine || 'this machine');
  const live = $derived(appState.connection === 'live');
  const status = $derived(appState.state?.projects?.[name]);
  const pending = $derived(status?.Pending ?? undefined);
  const view = $derived(
    pending ? changeView(name, pending, appState.state?.sites?.[name]?.routes ?? []) : undefined,
  );

  // The first change seen here, so one the file replaces while the page is open is told apart.
  let firstSha: string | undefined = $state();
  let seen = $state(false);
  $effect.pre(() => {
    const sha = pending?.SHA256;
    if (!sha) return;
    untrack(() => {
      firstSha ??= sha;
      seen = true;
    });
  });

  const answering = new Answering(() => ({ connection: appState.connection, machine }));
  const busy = $derived(!!answering.busy);
  const off = $derived(!live || busy);
  const describedBy = $derived(live ? undefined : 'connection-reason');

  function send(which: 'accept' | 'decline') {
    const sha = pending?.SHA256;
    if (!sha) return;
    void answering.send(which, () =>
      which === 'accept'
        ? apiClient().send('POST', '/v1/projects/{name}/change/accept', { sha }, { name })
        : apiClient().send('POST', '/v1/projects/{name}/change/decline', { sha }, { name }),
    );
  }
</script>

<div class="change">
  <h1>Change to <bdi>{name}</bdi></h1>
  {#if answering.done}
    <RequestCard
      icon="check"
      tone="quiet"
      level={2}
      title={[answering.done === 'accept' ? 'Approved' : 'Declined']}
    >
      <p class="done" role="status">
        {answering.done === 'accept'
          ? 'Approved what .nearhostrc asks for.'
          : `Declined. ${name} keeps serving what was approved before.`}
      </p>
      <a class="back" href={resolve('/')}>Back to the overview</a>
    </RequestCard>
  {:else if !appState.state}
    <ConnectionNotice waits="answering" />
    <p class="quiet">{appState.connection === 'signed-out' ? '' : `Connecting to ${machine}…`}</p>
  {:else if !view || !pending}
    <RequestCard icon="check" tone="quiet" level={2} title={['This request is no longer waiting']}>
      <p class="note">
        {seen
          ? 'It ended while this page was open: it was approved or declined elsewhere, or the file changed back.'
          : status
            ? `${name}'s .nearhostrc asks for nothing that needs approval now.`
            : `There is no project called ${name} on ${machine}.`}
      </p>
      <a class="back" href={resolve('/')}>Back to the overview</a>
    </RequestCard>
  {:else}
    <RequestCard
      icon="document"
      level={2}
      title={['Approve what its .nearhostrc asks for?']}
      intro={[view.intro]}
    >
      <ConnectionNotice waits="answering" />
      {#if firstSha && pending.SHA256 !== firstSha}
        <p class="note" role="status" data-replaced>
          The .nearhostrc changed again while this page was open. This is what it asks for now.
        </p>
      {/if}
      {#if view.items.length > 0}
        <div class="block">
          <h3>Needs your approval</h3>
          <ul class="items">
            {#each view.items as item, i (i)}
              <li>
                <span dir="auto" class="item">
                  {#each item.what as s, j (j)}{#if typeof s === 'string'}{s}{:else}<bdi
                        class:mono={s.mono}
                      >
                        {s.text}
                      </bdi>{/if}{/each}
                </span>
                <span class="why">{item.why}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if view.diff.length > 0}
        <div class="block">
          <h3>What it serves</h3>
          <ul class="diff" aria-label="Served now and after the change">
            {#each view.diff as line, i (i)}
              <li data-sign={line.sign}>
                <span class="sign" aria-hidden="true">{line.sign === ' ' ? '' : line.sign}</span>
                <span class="visually-hidden">
                  {line.sign === '+' ? 'Added: ' : line.sign === '-' ? 'Removed: ' : 'Kept: '}
                </span><bdi>{line.text}</bdi>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if answering.failure}
        <p class="problem" role="alert">{answering.failure.text}</p>
      {/if}
      <div class="answers" data-answers>
        <div class="row">
          <button
            type="button"
            class="primary"
            disabled={off}
            aria-busy={answering.busy === 'accept'}
            aria-describedby={describedBy}
            onclick={() => send('accept')}
          >
            Approve the change
          </button>
          <button
            type="button"
            disabled={off}
            aria-busy={answering.busy === 'decline'}
            aria-describedby={describedBy}
            onclick={() => send('decline')}
          >
            Decline
          </button>
        </div>
      </div>
    </RequestCard>
  {/if}
</div>

<style>
  .change {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .change > h1 {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
  }

  .quiet {
    margin: 0;
    color: var(--nh-muted);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  h3 {
    margin: 0;
    color: var(--nh-muted);
    font-size: 14px;
    font-weight: 500;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--nh-line);
    border-radius: var(--nh-radius-l);
    overflow: hidden;
  }

  li {
    padding: 12px 16px;
    border-bottom: 1px solid var(--nh-line);
    overflow-wrap: anywhere;
  }

  li:last-child {
    border-bottom: 0;
  }

  .items li {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    justify-content: space-between;
  }

  .item {
    min-width: 0;
  }

  .why {
    color: var(--pwa-warn-body);
    font-size: 14px;
  }

  .mono,
  .diff {
    font-family: var(--nh-font-mono);
    font-size: 14px;
  }

  .diff li {
    display: flex;
    gap: 10px;
    padding: 8px 16px;
  }

  .sign {
    flex: none;
    width: 1ch;
  }

  .diff li[data-sign='+'] {
    background: var(--pwa-running-bg);
  }

  .diff li[data-sign='+'] .sign {
    color: var(--pwa-running);
  }

  .diff li[data-sign='-'] {
    color: var(--pwa-failed);
  }
</style>
