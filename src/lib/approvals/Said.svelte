<script lang="ts">
  // A sentence of segments: the app's words as they are, what an agent or a config wrote as text in
  // a bidi isolate that wraps anywhere, so right-to-left text and long words keep to their line.
  // Never HTML: Svelte escapes every segment.
  import type { Segment } from './model.js';

  let { segments }: { segments: Segment[] } = $props();
</script>

{#each segments as segment, i (i)}{#if typeof segment === 'string'}{segment}{:else}<bdi
      class="quoted"
      class:mono={segment.mono}
    >
      {segment.text}
    </bdi>{/if}{/each}

<style>
  .quoted {
    overflow-wrap: anywhere;
    color: var(--nh-text);
  }

  .mono {
    font-family: var(--nh-font-mono);
    font-size: 0.9em;
  }
</style>
