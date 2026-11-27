<script lang="ts">
  // This device's settings, kept in its own storage: where projects open, how the reader shows a
  // document, and the app's appearance. They are the device's own, so they change whatever the
  // connection.
  import { themes } from '#lib/documents/model.js';
  import {
    documentsTheme,
    openProjectsIn,
    setDocumentsTheme,
    setOpenProjectsIn,
    type DocumentsTheme,
    type OpenProjectsIn,
  } from '#lib/settings.js';
  import { getAppearance, setAppearance, type Appearance } from '#lib/theme.js';
  import Segmented from '#lib/ui/Segmented.svelte';

  const places = [
    { id: 'app', label: 'The app' },
    { id: 'browser', label: 'Browser' },
  ] as const;

  const appearances = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ] as const;

  let openIn = $state<OpenProjectsIn>(openProjectsIn());
  let theme = $state<DocumentsTheme>(documentsTheme());
  let appearance = $state<Appearance>(getAppearance());
</script>

<h2 id="settings-heading">On this device</h2>
<div class="grid">
  <div class="card">
    <div class="label" id="setting-open-in">Open projects in</div>
    <Segmented
      labelledby="setting-open-in"
      options={places}
      value={openIn}
      fill
      onchange={(v) => {
        setOpenProjectsIn(v);
        openIn = v;
      }}
    />
  </div>
  <div class="card">
    <div class="label" id="setting-document-style">Document style</div>
    <Segmented
      labelledby="setting-document-style"
      options={themes}
      value={theme}
      fill
      onchange={(v) => {
        setDocumentsTheme(v);
        theme = v;
      }}
    />
  </div>
  <div class="card wide">
    <div class="about">
      <div class="label" id="setting-appearance">Appearance</div>
      <div class="note">System follows this device's light or dark setting.</div>
    </div>
    <div class="appearance">
      <Segmented
        labelledby="setting-appearance"
        options={appearances}
        value={appearance}
        fill
        onchange={(v) => {
          setAppearance(v);
          appearance = v;
        }}
      />
    </div>
  </div>
</div>

<style>
  h2 {
    margin: 0;
    font-family: var(--nh-font-display);
    font-size: 20px;
    font-weight: 600;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
    gap: 12px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    min-width: 0;
  }

  .wide {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
  }

  .about {
    flex: 1;
    min-width: 12em;
  }

  .label {
    font-weight: 600;
  }

  .note {
    margin-top: 2px;
    color: var(--nh-muted);
    font-size: 13px;
  }

  .appearance {
    display: flex;
    flex: 0 1 330px;
    min-width: 0;
  }

  .appearance > :global(*) {
    flex: 1;
  }

  @media (max-width: 599px) {
    .appearance {
      flex-basis: 100%;
    }
  }
</style>
