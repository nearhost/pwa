<script lang="ts">
  // The reader's Paper / Match app / As written switch, a segmented control in its own row.
  import type { DocumentsTheme } from '#lib/settings.js';
  import { themes } from './model.js';

  let {
    value,
    about,
    onchange,
    onclose,
  }: {
    value: DocumentsTheme;
    /** What the document is and who wrote it, such as "Markdown from Claude Code". */
    about: string;
    onchange: (theme: DocumentsTheme) => void;
    onclose: () => void;
  } = $props();

  const buttons: HTMLButtonElement[] = $state([]);

  function keydown(event: KeyboardEvent) {
    // Another overlay's Escape is its own.
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onclose();
    }
  }

  // A radio group is one tab stop, the checked option; the arrow keys pick the next one and move
  // the focus to it, wrapping round.
  function arrows(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + themes.length) % themes.length;
    onchange(themes[next].id);
    buttons[next]?.focus();
  }
</script>

<!-- Escape closes it, wherever the focus is: Safari doesn't focus a button it clicks. -->
<svelte:window onkeydown={keydown} />

<div class="switch" id="document-style">
  <p>{about}, {value === 'written' ? 'as it was written' : 'restyled for reading'}</p>
  <div class="segmented" role="radiogroup" aria-label="Document style">
    {#each themes as t, i (t.id)}
      <button
        type="button"
        role="radio"
        aria-checked={value === t.id}
        tabindex={value === t.id ? 0 : -1}
        bind:this={buttons[i]}
        onclick={() => onchange(t.id)}
        onkeydown={(event) => arrows(event, i)}
      >
        {t.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .switch {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 8px 16px;
    background: var(--nh-surface);
    border-bottom: 1px solid var(--nh-line);
  }

  p {
    flex: 1;
    min-width: 12em;
    margin: 0;
    color: var(--nh-muted);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .segmented {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-ground);
    border: 1px solid var(--nh-line);
  }

  button {
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--nh-radius-m);
    background: none;
    color: var(--nh-muted);
    font: inherit;
    font-size: 14px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  button[aria-checked='true'] {
    background: var(--nh-line);
    color: var(--nh-text);
    font-weight: 600;
  }

  button:active {
    transform: scale(0.96);
  }

  button:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 1px;
  }

  @media (max-width: 599px) {
    .segmented {
      flex: 1;
    }

    button {
      flex: 1;
      padding: 0 8px;
    }
  }
</style>
