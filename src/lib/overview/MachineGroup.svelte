<script lang="ts">
  // The projects of one machine: this machine first, then each server it reaches over SSH.
  import ProjectCard from './ProjectCard.svelte';
  import type { MachineGroup } from './model.js';

  let {
    group,
    machine,
    serverStatus,
    networked,
    live,
  }: {
    group: MachineGroup;
    machine: string;
    serverStatus?: string;
    networked: boolean;
    live: boolean;
  } = $props();

  const headingId = $derived(`machine-${group.key || 'local'}-heading`);
  const about = $derived(
    group.local
      ? `this machine · ${group.running} running`
      : `reached from ${machine} over SSH${serverStatus && serverStatus !== 'connected' ? ` · ${serverStatus}` : ''}`,
  );
</script>

<section class="group" id={`machine-${group.key || 'local'}`} aria-labelledby={headingId}>
  <div class="head">
    <h2 id={headingId}>{group.name}</h2>
    <span class="about">{about}</span>
  </div>
  <div class="projects">
    {#each group.projects as project (project.name)}
      <div class="item"><ProjectCard {project} {networked} {live} /></div>
    {/each}
  </div>
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    scroll-margin-top: calc(var(--pwa-band) + 80px);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
  }

  h2 {
    margin: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-display);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }

  .about {
    color: var(--nh-muted);
    font-size: 14px;
  }

  .item {
    display: grid;
  }

  .projects {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 12px;
  }

  @media (max-width: 599px) {
    .head {
      margin: 4px 4px 0;
    }

    h2 {
      font-family: var(--nh-font-body);
      font-size: 14px;
      font-weight: 500;
      color: var(--nh-muted);
      letter-spacing: 0;
    }

    .about {
      font-size: 13px;
    }

    .projects {
      display: flex;
      flex-direction: column;
      gap: 0;
      border-radius: var(--nh-radius-l);
      background: var(--nh-surface);
      box-shadow: var(--pwa-card);
      overflow: hidden;
    }

    .item + .item {
      border-top: 1px solid var(--nh-line);
    }
  }
</style>
