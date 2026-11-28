<script lang="ts">
  // The project's page in a frame, at the chosen width. The app can't see inside a frame from
  // another origin, so "didn't load" is a guess: the frame hasn't fired load within the time
  // limit, or its address is on another site than the page. The copy never claims a reason.
  import Icon from '#lib/ui/Icon.svelte';
  import { alwaysBrowser, setAlwaysBrowser } from '#lib/settings.js';
  import { loadTimeout } from './model.js';

  let {
    name,
    src,
    width,
    reload,
    crossSite,
  }: {
    name: string;
    src: string;
    width: number | undefined;
    /** Changes to load the page again. */
    reload: number;
    crossSite: boolean;
  } = $props();

  let loaded = $state(false);
  let timedOut = $state(false);
  // The setting lives in storage; changes counts this frame's own changes to it, to read it again.
  let changes = $state(0);
  const always = $derived((void changes, alwaysBrowser(name)));

  $effect(() => {
    // A new address, or a reload, starts the wait again.
    void src;
    void reload;
    loaded = false;
    timedOut = false;
    const timer = setTimeout(() => (timedOut = true), loadTimeout);
    return () => clearTimeout(timer);
  });

  function onload(event: Event) {
    const frame = event.currentTarget as HTMLIFrameElement;
    try {
      // The empty document a frame starts with is not the page.
      if (frame.contentWindow?.location.href === 'about:blank') return;
    } catch {
      // Another origin's page: it loaded.
    }
    loaded = true;
  }

  const refused = $derived(crossSite || (timedOut && !loaded));

  function setAlways(on: boolean) {
    setAlwaysBrowser(name, on);
    changes += 1;
  }
</script>

<div class="frame" style:max-width={width ? `${width}px` : undefined} class:sized={!!width}>
  {#if !crossSite}
    {#key `${src} ${reload}`}
      <iframe
        data-preview
        {src}
        title={`${name}, previewed`}
        class:behind={refused}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
        {onload}
      ></iframe>
    {/key}
  {/if}
  {#if refused}
    <div class="refused">
      <div class="message" role="alert">
        <span class="icon"><Icon name="refused" size={44} /></span>
        <h2>{name} didn't load in the frame</h2>
        <p>Some sites can't be shown inside another page, often on their login pages.</p>
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a project's own address, not the app's -->
        <a class="open" href={src} target="_blank" rel="noopener">
          <Icon name="external" size={18} stroke={2} />Open in browser
        </a>
        {#if always}
          <p class="set">
            Preview opens {name} in the browser from now on.
            <button type="button" class="link" onclick={() => setAlways(false)}>Undo</button>
          </p>
        {:else}
          <button type="button" class="link" onclick={() => setAlways(true)}>
            Always open {name} in the browser
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    flex: 1;
    display: flex;
    width: 100%;
    min-height: 0;
    margin: 0 auto;
  }

  iframe {
    flex: 1;
    width: 100%;
    height: 100%;
    border: 1px solid var(--nh-line);
    border-radius: var(--nh-radius-l);
    background: #fff;
  }

  iframe.behind {
    visibility: hidden;
  }

  .refused {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    overflow: auto;
  }

  .message {
    max-width: 500px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }

  .icon {
    color: var(--nh-muted);
  }

  h2 {
    margin: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-display);
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    color: var(--nh-body);
    line-height: 1.55;
  }

  .open {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    margin-top: 6px;
    padding: 0 18px;
    border-radius: var(--nh-radius-m);
    background: var(--nh-accent);
    color: var(--nh-accent-ink);
    font-weight: 600;
    text-decoration: none;
    transition: transform 150ms ease-out;
  }

  .open:active {
    transform: scale(0.96);
  }

  .link {
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--nh-text);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: var(--nh-muted);
  }

  .set .link {
    min-height: 0;
    padding: 0 4px;
  }

  .open:focus-visible,
  .link:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  @media (max-width: 599px) {
    iframe {
      border: 0;
      border-radius: 0;
    }

    .refused {
      border-radius: 0;
    }

    h2 {
      font-size: 20px;
    }
  }
</style>
