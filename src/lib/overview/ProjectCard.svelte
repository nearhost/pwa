<script lang="ts">
  // One project on the overview: its name, address, state and message, and what can be done with
  // it. A card on an iPad; on a phone a row whose name opens the preview.
  import Icon from '#lib/ui/Icon.svelte';
  import StartStop from '#lib/ui/StartStop.svelte';
  import StateDot from '#lib/ui/StateDot.svelte';
  import { alwaysBrowser, openProjectsIn } from '#lib/settings.js';
  import { actionError } from './actions.svelte.js';
  import {
    addressOf,
    hostOf,
    previewLink,
    stateLabel,
    unservedReason,
    type ProjectView,
  } from './model.js';

  let { project, networked, live }: { project: ProjectView; networked: boolean; live: boolean } =
    $props();

  const id = $derived(`project-${project.name}`);
  const state = $derived(project.status.State);
  const address = $derived(addressOf(project.primary, networked));
  // On a networked core, why the primary route can't be opened from here (no network address).
  const unserved = $derived(unservedReason(project.primary, networked, state));
  const link = $derived(
    previewLink(project.name, address, {
      openIn: openProjectsIn(),
      always: alwaysBrowser(project.name),
    }),
  );
  const running = $derived(state === 'running' || state === 'starting' || state === 'degraded');
  const count = $derived(project.routes.length);
  const detail = $derived(
    project.status.Message ||
      (count === 0
        ? 'No web route'
        : count === 1
          ? `port ${project.routes[0].port}`
          : `${count} routes`),
  );
  const error = $derived(actionError(project.name, state));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- the links go to previewLink's app path or to the project's own address -->
<article class="card" class:stopped={!running} data-state={state} aria-labelledby={id}>
  <span class="dot"><StateDot {state} /></span>
  <div class="title">
    <h3 {id}>{project.name}</h3>
    {#if address}
      <div class="host">{hostOf(address)}</div>
    {:else if unserved && running}
      <div class="host unserved" id={`${id}-unserved`}>{unserved}</div>
    {/if}
    <div class="detail" data-state={state}>{detail}</div>
  </div>
  <span class="pill" data-state={state}>
    {#if state !== 'stopped'}<StateDot {state} size={6} />{/if}{stateLabel(state)}
  </span>
  {#if running && !unserved}
    <!-- On a phone the row itself opens the preview. -->
    <a
      class="stretch"
      href={link.href}
      target={link.browser ? '_blank' : undefined}
      rel={link.browser ? 'noopener' : undefined}
      aria-label={`Preview ${project.name}`}
    ></a>
  {/if}
  <div class="actions">
    {#if running && unserved}
      <!-- Not on the network: nothing to open, said rather than a dead link. -->
      <button
        type="button"
        class="preview"
        disabled
        aria-label={`Preview ${project.name}`}
        aria-describedby={`${id}-unserved`}
      >
        <Icon name="frame" size={18} stroke={2} />Preview
      </button>
      <button
        type="button"
        class="icon-button"
        disabled
        aria-label={`Open ${project.name} in the browser`}
        aria-describedby={`${id}-unserved`}
      >
        <Icon name="external" size={18} stroke={2} />
      </button>
    {:else if running}
      <a
        class="preview"
        href={link.href}
        target={link.browser ? '_blank' : undefined}
        rel={link.browser ? 'noopener' : undefined}
        aria-label={`Preview ${project.name}`}
      >
        <Icon name="frame" size={18} stroke={2} />Preview
      </a>
      {#if address}
        <a
          class="icon-button"
          href={address}
          target="_blank"
          rel="noopener"
          aria-label={`Open ${project.name} in the browser`}
        >
          <Icon name="external" size={18} stroke={2} />
        </a>
      {/if}
    {/if}
    <StartStop name={project.name} {state} {running} {live} label={!running} />
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</article>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
  .card {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'title pill'
      'actions actions'
      'error error';
    gap: 12px 10px;
    padding: 16px 16px 12px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
  }

  .card.stopped {
    box-shadow: none;
    border: 1px dashed var(--nh-line);
  }

  .dot {
    display: none;
    grid-area: dot;
  }

  .title {
    grid-area: title;
    min-width: 0;
  }

  h3 {
    margin: 0;
    color: var(--nh-text);
    font-size: 17px;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .stopped h3 {
    color: var(--nh-body);
  }

  .host {
    margin-top: 4px;
    color: var(--nh-muted);
    font-family: var(--nh-font-mono);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .host.unserved {
    font-family: inherit;
  }

  .detail {
    margin-top: 12px;
    color: var(--nh-muted);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .detail[data-state='starting'],
  .detail[data-state='degraded'] {
    color: var(--pwa-warn-body);
  }

  .detail[data-state='error'] {
    color: var(--pwa-failed);
  }

  .pill {
    grid-area: pill;
    align-self: start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--nh-raised);
    color: var(--nh-muted);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  .pill[data-state='running'] {
    background: var(--pwa-running-bg);
    color: var(--pwa-running);
  }

  .pill[data-state='starting'],
  .pill[data-state='degraded'] {
    background: var(--pwa-warn-bg);
    color: var(--pwa-starting);
  }

  .pill[data-state='error'] {
    background: none;
    border: 1px solid var(--pwa-failed-line);
    color: var(--pwa-failed);
  }

  .pill[data-state='stopped'] {
    background: none;
    border: 1px solid var(--nh-line);
  }

  .stretch {
    display: none;
  }

  .actions {
    grid-area: actions;
    display: flex;
    gap: 8px;
  }

  .preview {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    border-radius: var(--nh-radius-m);
    background: var(--nh-accent);
    color: var(--nh-accent-ink);
    font-weight: 600;
    text-decoration: none;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--nh-radius-m);
    border: 1px solid var(--nh-line);
    color: var(--nh-text);
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  .icon-button:hover {
    background: var(--nh-raised);
  }

  .preview:disabled,
  .icon-button:disabled {
    background: var(--nh-raised);
    color: var(--nh-muted);
    font: inherit;
    font-weight: 600;
    border: 0;
    cursor: not-allowed;
    transform: none;
  }

  .preview:active,
  .icon-button:active {
    transform: scale(0.96);
  }

  .preview:focus-visible,
  .icon-button:focus-visible,
  .stretch:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  .error {
    grid-area: error;
    margin: 0;
    color: var(--pwa-failed);
    font-size: 14px;
  }

  /* A phone: one row, the dot, the name and address, and the open and start or stop buttons. */
  @media (max-width: 599px) {
    .card,
    .card.stopped {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        'dot title actions'
        'error error error';
      align-items: center;
      gap: 4px 12px;
      min-height: 64px;
      padding: 10px 8px 10px 14px;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      background: none;
    }

    .dot {
      display: block;
    }

    .preview {
      display: none;
    }

    /* The dot shows the state; the words stay for assistive tech. */
    .pill {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    h3 {
      font-size: 15px;
    }

    .host {
      margin-top: 0;
      font-size: 12px;
    }

    .detail {
      margin-top: 0;
      font-size: 12px;
    }

    .stretch {
      display: block;
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }

    .actions {
      position: relative;
      z-index: 1;
      gap: 4px;
    }

    .icon-button {
      border: 0;
    }
  }
</style>
