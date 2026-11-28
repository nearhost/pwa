<script lang="ts">
  // One agent's request, by its id: a proposal to add a project (which the app can only decline
  // until it can add projects), a passthrough or a document, with its answers. It follows the state: once the request is gone (answered elsewhere,
  // expired, given up on) it says it is no longer waiting, in place; what the user answered here
  // stays on the page after the core ends the request it took.
  import { onMount, tick, untrack } from 'svelte';
  import { resolve } from '$app/paths';
  import ConnectionNotice from '#lib/shell/ConnectionNotice.svelte';
  import { apiClient, appState, followEnvelopes } from '#lib/state.svelte.js';
  import { Answering } from './answer.svelte.js';
  import RequestCard from './RequestCard.svelte';
  import Said from './Said.svelte';
  import {
    contextOf,
    docView,
    originName,
    passView,
    proposalView,
    requesterName,
    type Approval,
    type Segment,
  } from './model.js';

  let { id }: { id: string } = $props();

  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 15_000);
    return () => clearInterval(timer);
  });

  // The core's ended envelope for this request, while the page is open.
  let endedHere = $state(false);
  onMount(() =>
    followEnvelopes((e) => {
      if (e.kind === 'ended' && e.id === id) endedHere = true;
    }),
  );

  const machine = $derived(appState.session?.machine || 'this machine');
  const live = $derived(appState.connection === 'live');
  const ctx = $derived(contextOf(appState.state, machine, now));
  const current = $derived(appState.state?.approvals?.find((a) => a.id === id));

  // The request as last seen, for what the page says once it is gone.
  let kept: Approval | undefined = $state();
  let reason = $state('');
  $effect.pre(() => {
    const seen = current;
    if (!seen) return;
    untrack(() => (kept = seen));
  });

  const answering = new Answering(() => ({ connection: appState.connection, machine }));
  let result: HTMLElement | undefined = $state();

  const shown = $derived(current ?? kept);
  const mode = $derived(
    answering.done
      ? 'done'
      : answering.failure?.kind === 'ended'
        ? 'gone'
        : current
          ? 'open'
          : appState.state
            ? 'gone'
            : 'loading',
  );
  const goneReason = $derived(
    answering.failure?.kind === 'ended'
      ? answering.failure.text
      : kept || endedHere
        ? 'It ended while this page was open: it was answered elsewhere, it expired, or the agent stopped waiting.'
        : 'It was answered, it expired, or the agent stopped waiting before this page opened.',
  );
  const busy = $derived(!!answering.busy);
  const off = $derived(!live || busy);
  const describedBy = $derived(live ? undefined : 'connection-reason');

  // Sends an answer, then takes the focus to what came of it, so it is read out and seen.
  async function send(a: string, ask: () => Promise<unknown>) {
    await answering.send(a, ask);
    await tick();
    result?.focus();
  }

  // A proposal is only declined here: the core's accept tells the agent the project was saved,
  // which the app can't do yet.
  function decline() {
    const r = reason.trim();
    void send('decline', () =>
      apiClient().send('POST', '/v1/proposals/{id}/decline', { reason: r }, { id }),
    );
  }

  function answer(kind: 'pass' | 'doc', a: 'yes' | 'no' | 'always') {
    void send(a, () =>
      kind === 'pass'
        ? apiClient().send('POST', '/v1/passthroughs/requests/{id}/answer', { answer: a }, { id })
        : apiClient().send('POST', '/v1/documents/requests/{id}/answer', { answer: a }, { id }),
    );
  }

  const q = (text: string) => ({ text });

  /** What came of the answer, in the request's words. */
  function doneText(a: Approval, said: string): Segment[] {
    if (a.proposal) return ['Declined. The agent was told no.'];
    const r = a.pass ?? a.doc;
    if (!r) return ['Answered.'];
    const who = q(requesterName(r.Requester));
    const where = q(originName(r.Origin, ctx));
    if (said === 'no') return ['Declined. ', who, ' was told no.'];
    if (a.pass) {
      const opened: Segment[] = [`Port ${a.pass.Remote} is open on ${machine}.`];
      return said === 'always'
        ? [...opened, ' ', who, ' on ', where, ' can open more without asking.']
        : opened;
    }
    const doc = a.doc!;
    const shownDoc: Segment[] = [{ text: doc.Doc, mono: true }, ' is shown in Documents.'];
    return said === 'always'
      ? [...shownDoc, ' ', who, ' can show documents from this folder without asking.']
      : shownDoc;
  }
</script>

{#snippet problem()}
  {#if answering.failure && answering.failure.kind !== 'ended'}
    {#if answering.done}
      <p class="problem" role="alert">{answering.failure.text}</p>
    {:else}
      <p class="problem" role="alert" tabindex="-1" bind:this={result}>
        {answering.failure.text}
      </p>
    {/if}
  {/if}
{/snippet}

{#snippet sending()}
  {#if answering.busy}<p class="sending">Sending…</p>{/if}
{/snippet}

{#snippet finished(a: Approval)}
  <p class="done" role="status" tabindex="-1" bind:this={result}>
    <Said segments={doneText(a, answering.done ?? '')} />
  </p>
  {@render problem()}
  <a class="back" href={resolve('/')}>Back to the overview</a>
{/snippet}

<div class="request">
  {#if mode === 'loading'}
    <h1>Waiting for you</h1>
    <ConnectionNotice waits="answering" />
    <p class="quiet">{appState.connection === 'signed-out' ? '' : `Connecting to ${machine}…`}</p>
  {:else if mode === 'gone' || !shown}
    <RequestCard icon="check" tone="quiet" title={['This request is no longer waiting']}>
      <p class="note" tabindex="-1" bind:this={result}>{goneReason}</p>
      <a class="back" href={resolve('/')}>Back to the overview</a>
    </RequestCard>
  {:else if shown.proposal}
    {@const v = proposalView(shown.proposal, ctx)}
    <RequestCard
      icon="code"
      title={v.title}
      intro={v.intro}
      waits={mode === 'open' ? v.waits : undefined}
    >
      {#if mode === 'done'}
        {@render finished(shown)}
      {:else}
        <ConnectionNotice waits="answering" />
        <dl class="fields">
          {#each v.fields as field (field.label)}
            <dt>{field.label}</dt>
            <dd dir="auto"><Said segments={field.value} /></dd>
          {/each}
        </dl>
        {#each v.notes as note, i (i)}
          <p class="note" data-proposal-note><Said segments={note} /></p>
        {/each}
        <label class="reason">
          Reason to tell the agent, if you decline
          <input type="text" bind:value={reason} placeholder="Optional" autocomplete="off" />
        </label>
        {@render problem()}
        <div class="answers" data-answers>
          <div class="row">
            <button
              type="button"
              disabled={off}
              aria-busy={answering.busy === 'decline'}
              aria-describedby={describedBy}
              onclick={decline}
            >
              Decline
            </button>
          </div>
          {@render sending()}
        </div>
      {/if}
    </RequestCard>
  {:else if shown.pass || shown.doc}
    {@const kind = shown.pass ? 'pass' : 'doc'}
    {@const v = shown.pass ? passView(shown.pass, ctx) : docView(shown.doc!, ctx)}
    {@const r = (shown.pass ?? shown.doc)!}
    <RequestCard
      icon={kind === 'pass' ? 'port' : 'document'}
      title={[v.title]}
      intro={v.intro}
      waits={mode === 'open' ? v.waits : undefined}
    >
      {#if mode === 'done'}
        {@render finished(shown)}
      {:else}
        <ConnectionNotice waits="answering" />
        <dl class="fields">
          {#each v.fields as field (field.label)}
            <dt>{field.label}</dt>
            <dd dir="auto"><Said segments={field.value} /></dd>
          {/each}
        </dl>
        {#each v.notes as note, i (i)}
          <p class="note"><Said segments={note} /></p>
        {/each}
        {@render problem()}
        <div class="answers" data-answers>
          <div class="row">
            <button
              type="button"
              class="primary"
              disabled={off}
              aria-busy={answering.busy === 'yes'}
              aria-describedby={describedBy}
              onclick={() => answer(kind, 'yes')}
            >
              {shown.pass ? `Open port ${shown.pass.Remote}` : 'Show the document'}
            </button>
            <button
              type="button"
              disabled={off}
              aria-busy={answering.busy === 'no'}
              aria-describedby={describedBy}
              onclick={() => answer(kind, 'no')}
            >
              Decline
            </button>
          </div>
          {#if v.canAlways}
            <button
              type="button"
              class="always"
              disabled={off}
              aria-busy={answering.busy === 'always'}
              aria-describedby={describedBy}
              onclick={() => answer(kind, 'always')}
            >
              Always allow <bdi>{requesterName(r.Requester)}</bdi> to {kind === 'pass'
                ? 'open ports'
                : 'show documents'} on <bdi>{originName(r.Origin, ctx)}</bdi>
            </button>
          {/if}
          {@render sending()}
        </div>
      {/if}
    </RequestCard>
  {:else}
    <RequestCard icon="waiting" title={['A request waits for your answer']}>
      <p class="note">This version of the app can't show this kind of request.</p>
      <a class="back" href={resolve('/')}>Back to the overview</a>
    </RequestCard>
  {/if}
</div>

<style>
  .request {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .quiet {
    margin: 0;
    color: var(--nh-muted);
  }

  .request :global([tabindex='-1']:focus) {
    outline: none;
  }
</style>
