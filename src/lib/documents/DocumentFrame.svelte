<script lang="ts">
  // A document in a frame. The sandbox leaves out allow-scripts, so nothing in the document runs,
  // and allow-same-origin, so it has an opaque origin and can't reach the app's cookies, its
  // CSRF token or the API. allow-popups lets a link that opens a new window open one; the core's
  // own policy for documents sandboxes that window the same way (no allow-popups-to-escape-sandbox
  // there), so adding the escape here would change nothing.
  //
  // A link followed inside the document loads in the frame. The app can't read where the frame
  // went (another origin), only that it loaded again, so it offers the way back.

  let { src, title }: { src: string; title: string } = $props();

  let loads = $state(0);
  let again = $state(0);

  $effect(() => {
    // A new document, or the way back to it, starts the count again.
    void src;
    void again;
    loads = 0;
  });
</script>

<div class="frame">
  {#if loads > 1}
    <div class="followed" data-followed-link role="status">
      <span>You followed a link in this document.</span>
      <button type="button" onclick={() => (again += 1)}>Back to the document</button>
    </div>
  {/if}
  {#key `${src} ${again}`}
    <iframe data-document {src} {title} sandbox="allow-popups" onload={() => (loads += 1)}></iframe>
  {/key}
</div>

<style>
  .frame {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  iframe {
    flex: 1;
    display: block;
    width: 100%;
    min-height: 0;
    border: 0;
    background: var(--nh-ground);
  }

  .followed {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding: 6px 16px;
    background: var(--pwa-warn-bg);
    border-bottom: 1px solid var(--pwa-warn-line);
    color: var(--pwa-warn-body);
    font-size: 14px;
  }

  .followed button {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--pwa-warn-line);
    border-radius: var(--nh-radius-m);
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 150ms ease-out,
      background-color 150ms ease-out;
  }

  .followed button:active {
    transform: scale(0.96);
  }

  .followed button:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }
</style>
