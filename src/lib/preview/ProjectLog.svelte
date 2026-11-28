<script lang="ts">
  // A project's log as it comes, following the newest line: while it starts, and while it runs
  // with nothing to frame.
  let { lines }: { lines: string[] } = $props();

  let log = $state<HTMLPreElement>();

  $effect(() => {
    // Follow the newest line.
    void lines.length;
    if (log) log.scrollTop = log.scrollHeight;
  });
</script>

<div class="log">
  <h3 id="project-log">Log</h3>
  <pre bind:this={log} aria-labelledby="project-log">{lines.length
      ? lines.join('\n')
      : 'Nothing logged yet.'}</pre>
</div>

<style>
  .log {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 120px;
  }

  h3 {
    margin: 0;
    color: var(--nh-muted);
    font-size: 14px;
    font-weight: 500;
  }

  pre {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 12px;
    overflow: auto;
    border-radius: var(--nh-radius-m);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    color: var(--nh-body);
    font-family: var(--nh-font-mono);
    font-size: 11.5px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
