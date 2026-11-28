<script lang="ts">
  // This machine: how the core serves (GET /v1/status), its version and this app's, the devices
  // paired with it (GET /v1/devices, on a core that serves the network), and this device's
  // settings. Read when the connection is live, again after a config change; what was read last
  // stays while the connection is down, and the notice says how old it is.
  import { onMount } from 'svelte';
  import { appVersion } from '#lib';
  import type { DeviceInfo, Status } from '#lib/api/types.js';
  import { apiClient, appState, followEnvelopes } from '#lib/state.svelte.js';
  import ConnectionNotice from '#lib/shell/ConnectionNotice.svelte';
  import StateDot from '#lib/ui/StateDot.svelte';
  import Devices from '#lib/machine/Devices.svelte';
  import Settings from '#lib/machine/Settings.svelte';
  import { machineFacts, type Tone } from '#lib/machine/model.js';
  import type { EngineState } from '#lib/overview/model.js';

  const machine = $derived(appState.session?.machine || 'this machine');
  const live = $derived(appState.connection === 'live');
  const networked = $derived(appState.session?.networked ?? false);

  let status: Status | undefined = $state();
  let devices: DeviceInfo[] | undefined = $state();
  let devicesError = $state('');

  const facts = $derived(machineFacts(status, appState.state?.info, appVersion));

  // Each read's number: an answer to an older one is dropped.
  let statusRead = 0;
  let devicesRead = 0;

  async function readStatus() {
    const n = ++statusRead;
    try {
      const answer = await apiClient().get('/v1/status');
      if (n === statusRead) status = answer;
    } catch {
      // The connection line and the notice say why; what was read last stays.
    }
  }

  async function readDevices() {
    const n = ++devicesRead;
    try {
      const answer = await apiClient().get('/v1/devices');
      if (n !== devicesRead) return;
      devices = answer;
      devicesError = '';
    } catch (e) {
      if (n === devicesRead && !devices)
        devicesError = `Couldn't read the paired devices: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Read whenever the connection is live again, and the devices once the session says networked.
  $effect(() => {
    if (!live) return;
    void readStatus();
  });
  $effect(() => {
    if (live && networked) void readDevices();
  });

  // A config change may turn the network on or off, or change its domain.
  onMount(() =>
    followEnvelopes((envelope) => {
      if (envelope.kind === 'config') void readStatus();
    }),
  );

  // The canvas's dot for each tone: a project's in the same state.
  const dots: Record<Tone, EngineState> = {
    running: 'running',
    starting: 'starting',
    failed: 'error',
    quiet: 'stopped',
  };
</script>

<div class="machine">
  <h1>This machine</h1>

  <ConnectionNotice waits="revoking and unpairing" />

  <section aria-labelledby="machine-name">
    <h2 id="machine-name"><bdi>{machine === 'this machine' ? 'This machine' : machine}</bdi></h2>
    <dl data-facts>
      {#each facts as fact (fact.term)}
        <div class="row">
          <dt>{fact.term}</dt>
          <dd class:mono={fact.mono}>
            {#if fact.tone}<StateDot state={dots[fact.tone]} />{/if}<span>{fact.value}</span>
          </dd>
        </div>
      {/each}
    </dl>
    {#if !status && !live && appState.connection !== 'signed-out'}
      <p class="quiet" role="status">The rest shows once {machine} answers.</p>
    {/if}
  </section>

  <section aria-labelledby={networked ? 'devices-heading' : undefined}>
    {#if !appState.session}
      <!-- Until the session is read, whether devices pair at all isn't known. -->
    {:else if !networked}
      <h2>Paired devices</h2>
      <p class="quiet">
        <bdi>{machine}</bdi> doesn't serve the network, so no devices pair with it. Turn networked mode
        on in its config to pair a phone or tablet.
      </p>
    {:else if devices}
      <Devices bind:devices {machine} reload={readDevices} />
    {:else if devicesError}
      <h2>Paired devices</h2>
      <p class="quiet" role="alert">{devicesError}</p>
    {:else}
      <h2>Paired devices</h2>
      <p class="quiet" role="status">Reading the paired devices…</p>
    {/if}
  </section>

  <section aria-labelledby="settings-heading">
    <Settings />
  </section>
</div>

<style>
  .machine {
    display: flex;
    flex-direction: column;
    gap: 32px;
    max-width: 760px;
  }

  h1 {
    margin: 0;
    font-size: 30px;
    letter-spacing: -0.02em;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h2 {
    margin: 0;
    font-family: var(--nh-font-display);
    font-size: 20px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  dl {
    margin: 0;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    overflow: hidden;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(110px, 180px) minmax(0, 1fr);
  }

  .row + .row {
    border-top: 1px solid var(--nh-line);
  }

  dt {
    padding: 14px 18px;
    color: var(--nh-muted);
  }

  dd {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 14px 18px;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  dd.mono {
    font-family: var(--nh-font-mono);
    font-size: 14px;
  }

  .quiet {
    margin: 0;
    color: var(--nh-muted);
  }

  @media (max-width: 599px) {
    .machine {
      gap: 24px;
    }

    h1 {
      font-size: 24px;
    }

    .row {
      grid-template-columns: 104px minmax(0, 1fr);
    }

    dt,
    dd {
      padding: 12px 14px;
    }

    dd.mono {
      font-size: 13px;
    }
  }
</style>
