<script lang="ts">
  // The paired devices, this one marked, each with Revoke (Unpair for this one) behind a
  // confirmation. Revoking this device signs it out: every screen then shows how to pair again.
  // Revoking waits for a live connection, and says why.
  import { tick } from 'svelte';
  import { ApiError, NotSignedIn } from '#lib/api/client.js';
  import type { DeviceInfo } from '#lib/api/types.js';
  import { apiClient, appState, signOut } from '#lib/state.svelte.js';
  import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import { deviceViews } from './model.js';

  let {
    devices = $bindable(),
    machine,
    reload,
  }: {
    devices: DeviceInfo[];
    machine: string;
    /** Reads the list again. */
    reload: () => Promise<void>;
  } = $props();

  const self = $derived(appState.session?.device ?? '');
  const views = $derived(deviceViews(devices, self));
  const live = $derived(appState.connection === 'live');

  let asking: { name: string; self: boolean } | undefined = $state();
  let busy = $state(false);
  let error = $state('');
  // Each row's button, by device name, so the focus can go back to it.
  const buttons: Record<string, HTMLButtonElement> = $state({});
  let heading: HTMLElement | undefined = $state();

  function ask(name: string, isSelf: boolean) {
    error = '';
    asking = { name, self: isSelf };
  }

  async function close(focusOn?: string) {
    asking = undefined;
    error = '';
    await tick();
    const button = focusOn ? buttons[focusOn] : undefined;
    if (button?.isConnected) button.focus();
    else heading?.focus();
  }

  async function confirm() {
    if (!asking || busy) return;
    const { name, self: isSelf } = asking;
    busy = true;
    error = '';
    try {
      await apiClient().send('DELETE', '/v1/devices/{name}', undefined, { name });
    } catch (e) {
      busy = false;
      // Signed out already: every screen says so now.
      if (e instanceof NotSignedIn) return void (asking = undefined);
      // Another device revoked it first: it is gone either way.
      if (!(e instanceof ApiError && e.problem.code === 'device.unknown')) {
        error = `Couldn't ${isSelf ? 'unpair this device' : `revoke ${name}`}: ${e instanceof Error ? e.message : String(e)}`;
        return;
      }
    }
    busy = false;
    if (isSelf) {
      asking = undefined;
      signOut();
      return;
    }
    devices = devices.filter((d) => d.name !== name);
    await close();
    void reload();
  }
</script>

<div class="head">
  <h2 id="devices-heading" tabindex="-1" bind:this={heading}>Paired devices</h2>
  <span class="how">Pair another with <code>nearhost pair</code> on <bdi>{machine}</bdi></span>
</div>

{#if views.length === 0}
  <p class="quiet">No devices are paired.</p>
{:else}
  <ul data-devices aria-labelledby="devices-heading">
    {#each views as device (device.name)}
      <li>
        <span class="icon"><Icon name={device.kind} size={22} /></span>
        <div class="who">
          <div class="name">
            <bdi>{device.name}</bdi>
            {#if device.self}<span class="self">this device</span>{/if}
          </div>
          {#if device.detail}<div class="detail">{device.detail}</div>{/if}
        </div>
        <button
          type="button"
          class:danger={!device.self}
          bind:this={buttons[device.name]}
          disabled={!live}
          aria-describedby={live ? undefined : 'connection-reason'}
          aria-label={device.self ? 'Unpair this device' : `Revoke ${device.name}`}
          onclick={() => ask(device.name, device.self)}
        >
          {device.self ? 'Unpair' : 'Revoke'}
        </button>
      </li>
    {/each}
  </ul>
{/if}

<ConfirmDialog
  open={!!asking}
  title={asking?.self ? 'Unpair this device?' : `Revoke ${asking?.name ?? ''}?`}
  confirmLabel={asking?.self ? 'Unpair' : 'Revoke'}
  busyLabel={asking?.self ? 'Unpairing…' : 'Revoking…'}
  {busy}
  {error}
  onconfirm={confirm}
  oncancel={() => close(asking?.name)}
>
  {#if asking?.self}
    This device signs out of <bdi>{machine}</bdi>. To use Nearhost here again, pair it with
    <code>nearhost pair</code> on <bdi>{machine}</bdi>.
  {:else}
    <bdi>{asking?.name}</bdi> will need to pair again with <code>nearhost pair</code> on
    <bdi>{machine}</bdi> before it can open Nearhost.
  {/if}
</ConfirmDialog>

<style>
  .head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 10px;
  }

  h2 {
    flex: 1;
    margin: 0;
    font-family: var(--nh-font-display);
    font-size: 20px;
    font-weight: 600;
    white-space: nowrap;
  }

  h2:focus {
    outline: none;
  }

  .how {
    color: var(--nh-muted);
    font-size: 14px;
  }

  code {
    font-family: var(--nh-font-mono);
    font-size: 0.93em;
    color: var(--nh-text);
  }

  .quiet {
    margin: 0;
    color: var(--nh-muted);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
  }

  li {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 64px;
    padding: 10px 18px;
    box-sizing: border-box;
  }

  li + li {
    border-top: 1px solid var(--nh-line);
  }

  .icon {
    flex: none;
    display: flex;
    color: var(--nh-muted);
  }

  .who {
    flex: 1;
    min-width: 0;
  }

  .name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .self {
    margin-left: 4px;
    color: var(--pwa-running);
    font-size: 13px;
    font-weight: 400;
    white-space: nowrap;
  }

  .detail {
    color: var(--nh-muted);
    font-size: 13px;
  }

  button {
    flex: none;
    min-height: 44px;
    padding: 0 16px;
    border-radius: var(--nh-radius-m);
    border: 1px solid var(--nh-line);
    background: none;
    color: var(--nh-text);
    font: inherit;
    cursor: pointer;
    transition: transform 150ms ease-out;
  }

  button.danger {
    border-color: var(--pwa-failed-line);
    color: var(--pwa-failed);
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
    opacity: 0.5;
  }
</style>
