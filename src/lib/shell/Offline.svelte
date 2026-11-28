<script lang="ts">
  // The canvas's Offline screen: what every route shows once the core can't be reached (see
  // #lib/offline/model.ts for when). What to check, in the canvas's words, Try again, and when the
  // core last answered. Try again connects at once; while it tries, the button says so.
  import { onMount } from 'svelte';
  import { appState, retry } from '#lib/state.svelte.js';
  import { answeredAt } from '#lib/offline/model.js';
  import Icon from '#lib/ui/Icon.svelte';

  let {
    machine,
    lastAnswered,
  }: {
    /** The machine's name, or "this machine" when the app has never heard it. */
    machine: string;
    lastAnswered: Date | undefined;
  } = $props();

  const host = location.host;
  // A machine's name is written as it is, lower case and all, even to start a sentence.
  const Machine = $derived(machine === 'this machine' ? 'This machine' : machine);
  const trying = $derived(appState.connection === 'connecting');
  const at = $derived(lastAnswered && answeredAt(lastAnswered, new Date()));

  // It takes the place of the screen, and of whatever had the focus there.
  let heading: HTMLHeadingElement | undefined = $state();
  onMount(() => {
    if (!document.activeElement || document.activeElement === document.body) heading?.focus();
  });
</script>

<div class="offline" data-offline>
  <div class="content">
    <span class="icon"><Icon name="offline" size={44} /></span>
    <h1 tabindex="-1" bind:this={heading}>Can't reach <bdi>{machine}</bdi></h1>
    <p>
      This device asked <code>{host}</code> and got no answer. Your projects are fine on
      <bdi>{machine}</bdi>; this device just can't see it right now.
    </p>
    <ol>
      <li>
        <span class="n">1</span>
        <span>
          This device is on the same network as <bdi>{machine}</bdi>, or Tailscale is connected.
        </span>
      </li>
      <li><span class="n">2</span><span><bdi>{Machine}</bdi> is switched on and awake.</span></li>
      <li>
        <span class="n">3</span>
        <span>
          The core is running: <code>nearhost status</code> on <bdi>{machine}</bdi> says so.
        </span>
      </li>
    </ol>
    <div class="again">
      <!-- aria-disabled, not disabled, so a focused button keeps the focus while it tries. -->
      <button
        type="button"
        onclick={() => {
          if (!trying) retry();
        }}
        aria-disabled={trying}
        aria-describedby={at ? 'last-answered' : undefined}
      >
        {trying ? 'Trying…' : 'Try again'}
      </button>
      {#if at}<span class="when" id="last-answered">Last answered at {at}</span>{/if}
    </div>
  </div>
</div>

<style>
  .offline {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60dvh;
    padding-bottom: 60px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 540px;
    min-width: 0;
  }

  .icon {
    display: flex;
    color: var(--pwa-failed);
  }

  h1 {
    margin: 0;
    outline: none;
    font-size: 30px;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    font-size: 17px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  code {
    font-family: var(--nh-font-mono);
    font-size: 0.88em;
  }

  ol {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
  }

  li {
    display: flex;
    gap: 14px;
    padding: 14px 18px;
    color: var(--nh-text);
    overflow-wrap: anywhere;
  }

  li + li {
    border-top: 1px solid var(--nh-line);
  }

  .n {
    flex: none;
    color: var(--nh-muted);
    font-family: var(--nh-font-mono);
  }

  .again {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
    margin-top: 6px;
  }

  button {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: var(--nh-radius-m);
    background: var(--nh-accent);
    color: var(--nh-accent-ink);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: transform 150ms ease-out;
  }

  button:active:not([aria-disabled='true']) {
    transform: scale(0.96);
  }

  button[aria-disabled='true'] {
    cursor: default;
    opacity: 0.7;
  }

  button:focus-visible {
    outline: 2px solid var(--nh-text);
    outline-offset: 2px;
  }

  .when {
    color: var(--nh-muted);
    font-size: 14px;
  }

  @media (max-width: 599px) {
    h1 {
      font-size: 26px;
    }

    .offline {
      align-items: flex-start;
      min-height: 0;
      padding-bottom: 0;
    }
  }
</style>
