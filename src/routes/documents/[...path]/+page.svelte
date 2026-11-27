<script lang="ts">
  // The reader: one document in a sandboxed frame, as the core serves it at /d/<tree>/<path>, in
  // the device's documents theme, with the switch between Paper, Match app and As written.
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { appState } from '#lib/state.svelte.js';
  import ConnectionNotice from '#lib/shell/ConnectionNotice.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import { documentsTheme, setDocumentsTheme, type DocumentsTheme } from '#lib/settings.js';
  import { requesterName } from '#lib/approvals/model.js';
  import DocumentFrame from '#lib/documents/DocumentFrame.svelte';
  import ThemeSwitch from '#lib/documents/ThemeSwitch.svelte';
  import { currentScheme, followScheme } from '#lib/documents/scheme.js';
  import {
    documentSrc,
    findDocument,
    readerTarget,
    titleOf,
    whereOf,
    type Scheme,
  } from '#lib/documents/model.js';

  const rest = $derived(page.params.path ?? '');
  const target = $derived(readerTarget(rest));
  const title = $derived(titleOf(target?.path ?? rest) || 'Document');
  const machine = $derived(appState.session?.machine || 'this machine');
  const found = $derived(target && findDocument(appState.state, target.id, target.path));

  let theme = $state<DocumentsTheme>(documentsTheme());
  let scheme = $state<Scheme>(currentScheme());
  let switching = $state(false);
  let styleButton = $state<HTMLButtonElement>();

  onMount(() => followScheme((s) => (scheme = s)));

  const src = $derived(target ? documentSrc(target.id, target.path, theme, scheme) : '');
  const kind = $derived(
    /\.(md|markdown)$/i.test(target?.path ?? '')
      ? 'Markdown'
      : /\.html?$/i.test(target?.path ?? '')
        ? 'HTML'
        : 'A document',
  );

  function choose(next: DocumentsTheme) {
    theme = next;
    setDocumentsTheme(next);
  }

  function close() {
    switching = false;
    styleButton?.focus();
  }
</script>

<div class="reader">
  <div class="bar">
    <a class="back" href={resolve('/documents')} aria-label="Back to documents">
      <Icon name="back" size={22} stroke={2} />
    </a>
    <div class="title">
      <h1><bdi>{title}</bdi></h1>
      {#if found && target}
        <span class="sub">
          <bdi>{whereOf(found.tree.Server, machine)}</bdi> ·
          <bdi>{found.tree.Root.replace(/\/$/, '')}/{target.path}</bdi>
        </span>
      {/if}
    </div>
    {#if found}
      <button
        type="button"
        class="icon-button aa"
        aria-label="Document style"
        aria-expanded={switching}
        aria-controls="document-style"
        bind:this={styleButton}
        onclick={() => (switching = !switching)}
      >
        Aa
      </button>
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the core's address for the document, not an app route -->
      <a class="open" href={src} target="_blank" rel="noopener">
        <Icon name="external" size={18} stroke={2} /><span class="label">Open in browser</span>
      </a>
    {/if}
  </div>

  {#if found && switching}
    <ThemeSwitch
      value={theme}
      about={`${kind} from ${requesterName(found.tree.Requester)}`}
      onchange={choose}
      onclose={close}
    />
  {/if}

  <ConnectionNotice waits="reading" />

  {#if !appState.state}
    <p class="quiet" role="status">
      {appState.connection === 'signed-out' ? '' : `Connecting to ${machine}…`}
    </p>
  {:else if !found}
    <div class="panel">
      <span class="icon"><Icon name="document" size={44} /></span>
      <p>This document isn’t served any more.</p>
      <a class="text-link" href={resolve('/documents')}>Go to documents</a>
    </div>
  {:else}
    <DocumentFrame {src} title={`${title}, the document`} />
  {/if}
</div>

<style>
  .reader {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 64px;
    padding: 8px 12px;
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
    border: 0;
    border-radius: var(--nh-radius-m);
    background: none;
    color: var(--nh-text);
    cursor: pointer;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  .aa {
    font-family: var(--nh-font-display);
    font-size: 17px;
    font-weight: 600;
  }

  .aa[aria-expanded='true'] {
    background: var(--nh-raised);
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
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-family: var(--nh-font-body);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    color: var(--nh-muted);
    font-family: var(--nh-font-mono);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .reader > :global(.notice) {
    margin: 12px 12px 0;
  }

  .quiet {
    margin: 0;
    padding: 20px;
    color: var(--nh-muted);
  }

  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 36px 60px;
    text-align: center;
  }

  .panel .icon {
    display: flex;
    color: var(--nh-muted);
  }

  .panel p {
    margin: 0;
    color: var(--nh-body);
  }

  .text-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    color: var(--nh-text);
    text-underline-offset: 3px;
    text-decoration-color: var(--nh-muted);
  }

  /* A phone: Open in browser is its icon, as in the canvas. */
  @media (max-width: 599px) {
    .bar {
      gap: 4px;
      padding: 8px;
    }

    .open {
      width: 44px;
      padding: 0;
      justify-content: center;
      background: none;
      color: var(--nh-text);
    }

    .open .label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
</style>
