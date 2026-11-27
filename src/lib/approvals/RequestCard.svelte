<script lang="ts">
  // The card a request is answered in, as the canvas's Approve: the request's icon, its question
  // as the page's heading, who asked and from where, then what it holds and the answers. The
  // shared parts inside (fields, notes, answers, what came of it) are styled here.
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '#lib/ui/Icon.svelte';
  import Said from './Said.svelte';
  import type { Segment } from './model.js';

  let {
    icon,
    title,
    level = 1,
    intro,
    waits,
    tone = 'ask',
    children,
  }: {
    icon: IconName;
    title: Segment[];
    /** The heading's level: 1, unless the page has its own heading. */
    level?: 1 | 2;
    intro?: Segment[];
    waits?: string;
    /** ask: it waits for an answer; quiet: it is over. */
    tone?: 'ask' | 'quiet';
    children?: Snippet;
  } = $props();
</script>

<section class="card" data-request-card aria-labelledby="request-title">
  <div class="top">
    <span class="badge" data-tone={tone}><Icon name={icon} size={22} stroke={2} /></span>
    <div class="what">
      <svelte:element this={`h${level}`} id="request-title" class="title">
        <Said segments={title} />
      </svelte:element>
      {#if intro || waits}
        <p class="intro">
          {#if intro}<Said segments={intro} />{/if}
          {#if waits}<span>{waits}</span>{/if}
        </p>
      {/if}
    </div>
  </div>
  {@render children?.()}
</section>

<style>
  .card {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    color: var(--nh-text);
    animation: rise 200ms ease-out both;
  }

  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }

  .top {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--nh-radius-l);
    background: var(--pwa-warn-bg);
    color: var(--pwa-starting);
  }

  .badge[data-tone='quiet'] {
    background: var(--nh-raised);
    color: var(--nh-muted);
  }

  .what {
    flex: 1;
    min-width: 0;
  }

  .title {
    margin: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-display);
    font-size: 24px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
  }

  .intro {
    margin: 6px 0 0;
    color: var(--nh-muted);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  /* What the request holds: a label and its value on each row. */
  .card :global(.fields) {
    margin: 0;
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    border: 1px solid var(--nh-line);
    border-radius: var(--nh-radius-l);
    overflow: hidden;
  }

  .card :global(.fields dt),
  .card :global(.fields dd) {
    margin: 0;
    padding: 14px 16px;
    border-bottom: 1px solid var(--nh-line);
  }

  .card :global(.fields dt) {
    color: var(--nh-muted);
  }

  .card :global(.fields dd) {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .card :global(.fields dd.input) {
    padding: 8px 12px;
  }

  .card :global(.fields > :nth-last-child(-n + 2)) {
    border-bottom: 0;
  }

  .card :global(input[type='text']) {
    width: 100%;
    height: 40px;
    padding: 0 10px;
    border-radius: var(--nh-radius-m);
    border: 1px solid var(--nh-line);
    background: var(--nh-ground);
    color: var(--nh-text);
    font: inherit;
  }

  .card :global(input[type='text']:focus-visible) {
    outline: 2px solid var(--nh-accent);
    outline-offset: 1px;
  }

  .card :global(.note) {
    margin: 0;
    padding: 12px 14px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-ground);
    color: var(--nh-muted);
    font-size: 14px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .card :global(.reason) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--nh-muted);
    font-size: 14px;
  }

  /* The answers: the main two side by side, Always allow under them. */
  .card :global(.answers) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .card :global(.answers .row) {
    display: flex;
    gap: 10px;
  }

  .card :global(.answers button) {
    flex: 1;
    min-width: 0;
    min-height: 52px;
    padding: 8px 16px;
    border-radius: var(--nh-radius-m);
    border: 1px solid var(--nh-line);
    background: none;
    color: var(--nh-text);
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition:
      scale 150ms ease-out,
      background-color 150ms ease-out;
  }

  .card :global(.answers button.primary) {
    border: 0;
    background: var(--nh-accent);
    color: var(--nh-accent-ink);
  }

  .card :global(.answers button.always) {
    min-height: 48px;
    border: 0;
    font-weight: 400;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: var(--nh-muted);
  }

  .card :global(.answers button:active:not(:disabled)) {
    scale: 0.96;
  }

  .card :global(.answers button:disabled) {
    opacity: 0.5;
    cursor: default;
  }

  .card :global(.answers button[aria-busy='true']) {
    opacity: 0.75;
  }

  .card :global(.answers button:focus-visible) {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  .card :global(.sending) {
    margin: 0;
    color: var(--nh-muted);
    font-size: 14px;
    text-align: center;
  }

  .card :global(.problem) {
    margin: 0;
    padding: 12px 14px;
    border-radius: var(--nh-radius-l);
    border: 1px solid var(--pwa-failed-line);
    color: var(--pwa-failed);
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .card :global(.done) {
    margin: 0;
    padding: 12px 14px;
    border-radius: var(--nh-radius-l);
    background: var(--pwa-running-bg);
    color: var(--nh-text);
    overflow-wrap: anywhere;
  }

  .card :global(.back) {
    align-self: flex-start;
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 16px;
    border-radius: var(--nh-radius-m);
    border: 1px solid var(--nh-line);
    color: var(--nh-text);
    font-weight: 600;
    text-decoration: none;
  }

  .card :global(.back:focus-visible) {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  @media (max-width: 599px) {
    .card {
      padding: 20px;
      gap: 16px;
    }

    .title {
      font-size: 22px;
    }

    .card :global(.fields) {
      grid-template-columns: 84px minmax(0, 1fr);
      font-size: 14px;
    }

    .card :global(.fields dt),
    .card :global(.fields dd) {
      padding: 12px 14px;
    }

    .card :global(.answers .row) {
      flex-direction: column;
      gap: 8px;
    }
  }
</style>
