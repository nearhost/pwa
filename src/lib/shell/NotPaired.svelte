<script lang="ts">
  // What every screen shows while this device isn't paired (the core answers 401): the canvas's
  // PhonePair guidance. In a browser tab, open the link `nearhost pair` prints, then add the app
  // to the Home Screen; in the installed app, type the code on the core's own pairing form at
  // /pair, which is on this origin and outside the app.
  import { appState } from '#lib/state.svelte.js';
  import Icon from '#lib/ui/Icon.svelte';

  const machine = $derived(appState.session?.machine ?? '');
  const on = $derived(machine || 'the machine that runs Nearhost');
  // The shell's attribute, which watchDisplayMode keeps.
  const installed = document.documentElement.getAttribute('data-display-mode') === 'standalone';
</script>

<div class="pair">
  <h1>Pair this device{machine ? ` with ${machine}` : ''}</h1>
  {#if installed}
    <p>
      Type the code <code>nearhost pair</code> printed on <bdi>{on}</bdi>. It stays paired.
    </p>
  {:else}
    <p>
      Run <code>nearhost pair</code> on <bdi>{on}</bdi> and open the link it prints in this browser, or
      type the code it prints. It stays paired.
    </p>
  {/if}
  <!-- The core's pairing form: a page load, not one of the app's routes. -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the core's page, outside the app -->
  <a class="button" href="/pair" data-sveltekit-reload>Type the code</a>

  {#if !installed}
    <div class="install">
      <span class="icon"><Icon name="share" size={22} /></span>
      <span>
        After pairing, choose <strong>Add to Home Screen</strong> or <strong>Install app</strong>
        from your browser's menu. Nearhost then opens on its own, without the browser's bars.
      </span>
    </div>
  {/if}
</div>

<style>
  .pair {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
    max-width: 560px;
  }

  h1 {
    margin: 0;
    font-size: 32px;
    line-height: 1.1;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    color: var(--nh-muted);
    line-height: 1.55;
  }

  code {
    font-family: var(--nh-font-mono);
    font-size: 0.93em;
    color: var(--nh-text);
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 52px;
    padding: 0 24px;
    border-radius: var(--nh-radius-m);
    background: var(--nh-accent);
    color: var(--pwa-accent-ink);
    font-weight: 600;
    font-size: 17px;
    text-decoration: none;
    transition: transform 150ms ease-out;
  }

  .button:active {
    transform: scale(0.96);
  }

  .button:focus-visible {
    outline: 2px solid var(--nh-text);
    outline-offset: 2px;
  }

  .install {
    display: flex;
    gap: 12px;
    padding: 16px;
    border-radius: var(--nh-radius-l);
    border: 1px solid var(--nh-line);
    color: var(--nh-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .install strong {
    color: var(--nh-text);
    font-weight: 400;
  }

  .icon {
    flex: none;
    display: flex;
  }

  @media (max-width: 599px) {
    h1 {
      font-size: 28px;
    }

    .button {
      align-self: stretch;
    }
  }
</style>
