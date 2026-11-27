<script lang="ts">
  // A modal question before something that can't be undone: the browser's own <dialog>, so the
  // rest of the page is inert, the focus stays inside and Escape cancels (except while the answer
  // is being sent). The focus goes back where the caller says when it closes: Safari doesn't
  // focus a button it clicks, so the browser can't know.
  import type { Snippet } from 'svelte';

  let {
    open,
    title,
    confirmLabel,
    busyLabel,
    busy = false,
    error = '',
    onconfirm,
    oncancel,
    children,
  }: {
    open: boolean;
    title: string;
    confirmLabel: string;
    /** What the confirm button says while busy, such as "Revoking…". */
    busyLabel: string;
    busy?: boolean;
    /** Why the last try failed. */
    error?: string;
    onconfirm: () => void;
    oncancel: () => void;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let cancelButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The safe choice first.
      cancelButton?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function cancel(event: Event) {
    // Escape: the dialog closes only through open, and not while the answer is on its way.
    event.preventDefault();
    if (!busy) oncancel();
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="confirm-title"
  aria-describedby="confirm-body"
  oncancel={cancel}
>
  <h2 id="confirm-title">{title}</h2>
  <div id="confirm-body" class="body">{@render children()}</div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="buttons">
    <button type="button" class="quiet" bind:this={cancelButton} disabled={busy} onclick={oncancel}>
      Cancel
    </button>
    <button type="button" class="danger" disabled={busy} aria-busy={busy} onclick={onconfirm}>
      {busy ? busyLabel : confirmLabel}
    </button>
  </div>
</dialog>

<style>
  dialog {
    width: min(420px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 24px;
    border: 0;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    color: var(--nh-text);
    box-shadow:
      var(--pwa-card),
      0 16px 48px oklch(0 0 0 / 0.3);
  }

  dialog::backdrop {
    background: rgba(6, 8, 7, 0.72);
    background: var(--pwa-overlay, rgba(6, 8, 7, 0.72));
  }

  h2 {
    margin: 0;
    font-family: var(--nh-font-display);
    font-size: 20px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .body {
    margin-top: 10px;
    color: var(--nh-body);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .error {
    margin: 14px 0 0;
    color: var(--pwa-failed);
    font-size: 14px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 22px;
  }

  button {
    min-height: 44px;
    padding: 0 18px;
    border-radius: var(--nh-radius-m);
    font: inherit;
    cursor: pointer;
    transition: transform 150ms ease-out;
  }

  button:active:not(:disabled) {
    transform: scale(0.96);
  }

  button:focus-visible {
    outline: 2px solid var(--nh-accent);
    outline-offset: 2px;
  }

  button:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .quiet {
    border: 1px solid var(--nh-line);
    background: none;
    color: var(--nh-text);
  }

  .danger {
    border: 1px solid var(--pwa-failed-line);
    background: none;
    color: var(--pwa-failed);
    font-weight: 600;
  }
</style>
