<script lang="ts">
  // The reader's Paper / Match app / As written switch, a segmented control in its own row.
  import type { DocumentsTheme } from '#lib/settings.js';
  import Segmented from '#lib/ui/Segmented.svelte';
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

  function keydown(event: KeyboardEvent) {
    // Another overlay's Escape is its own.
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onclose();
    }
  }
</script>

<!-- Escape closes it, wherever the focus is: Safari doesn't focus a button it clicks. -->
<svelte:window onkeydown={keydown} />

<div class="switch" id="document-style">
  <p>{about}, {value === 'written' ? 'as it was written' : 'restyled for reading'}</p>
  <Segmented label="Document style" options={themes} {value} {onchange} --segment-height="36px" />
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
</style>
