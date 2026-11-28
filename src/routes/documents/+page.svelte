<script lang="ts">
  // The documents agents have had Nearhost serve, by the folder they are in, newest first; the
  // canvas's empty state when there are none.
  import { appState } from '#lib/state.svelte.js';
  import ConnectionNotice from '#lib/shell/ConnectionNotice.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import NoDocuments from '#lib/documents/NoDocuments.svelte';
  import { documentTrees, openedLabel } from '#lib/documents/model.js';

  const machine = $derived(appState.session?.machine || 'this machine');
  const trees = $derived(documentTrees(appState.state, machine));
</script>

<div class="documents">
  <h1>Documents</h1>

  <ConnectionNotice waits="reading" />

  {#if !appState.state}
    <p class="quiet" role="status">
      {appState.connection === 'signed-out' ? '' : `Connecting to ${machine}…`}
    </p>
  {:else if trees.length === 0}
    <NoDocuments />
  {:else}
    {#each trees as tree (tree.id)}
      <section class="tree" aria-labelledby={`tree-${tree.id}`}>
        <div class="head">
          <h2 id={`tree-${tree.id}`}><bdi>{tree.name}</bdi></h2>
          <p class="who"><bdi>{tree.where}</bdi> · <bdi>{tree.requester}</bdi></p>
          <p class="root"><bdi>{tree.root}</bdi></p>
        </div>
        <ul>
          {#each tree.docs as doc (doc.path)}
            <li>
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- readerHref is the app's own path, escaped -->
              <a href={doc.href}>
                <span class="icon"><Icon name="document" size={22} /></span>
                <span class="name">
                  <bdi class="title">{doc.title}</bdi>
                  {#if doc.folder}<bdi class="folder">{doc.folder}</bdi>{/if}
                </span>
                {#if openedLabel(doc.opened)}
                  <time datetime={doc.opened}>{openedLabel(doc.opened)}</time>
                {/if}
                <span class="go"><Icon name="forward" size={18} /></span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<style>
  .documents {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100%;
    max-width: 760px;
  }

  h1 {
    margin: 0;
    font-size: 30px;
    letter-spacing: -0.02em;
  }

  .tree {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .head {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: baseline;
    gap: 2px 12px;
    padding: 0 4px;
  }

  h2 {
    margin: 0;
    font-family: var(--nh-font-display);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }

  .who {
    margin: 0;
    color: var(--nh-muted);
    font-size: 14px;
  }

  .root {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--nh-muted);
    font-family: var(--nh-font-mono);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  ul {
    margin: 0;
    padding: 4px;
    list-style: none;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
  }

  li + li {
    border-top: 1px solid var(--nh-line);
  }

  a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 12px;
    border-radius: var(--nh-radius-m);
    color: var(--nh-text);
    text-decoration: none;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  a:hover {
    background: var(--nh-raised);
  }

  a:active {
    transform: scale(0.96);
  }

  a:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  .icon,
  .go {
    flex: none;
    display: flex;
    color: var(--nh-muted);
  }

  .name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .title {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .folder {
    color: var(--nh-muted);
    font-family: var(--nh-font-mono);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  time {
    flex: none;
    color: var(--nh-muted);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  .quiet {
    margin: 0;
    color: var(--nh-muted);
  }

  @media (max-width: 599px) {
    .documents {
      gap: 18px;
    }

    h1 {
      font-size: 24px;
    }
  }
</style>
