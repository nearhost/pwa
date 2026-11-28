<script lang="ts">
  // Nothing served yet: what a project is for, how to add one, and the agents' way in.
  import Mark from '#lib/shell/Mark.svelte';
  import Icon from '#lib/ui/Icon.svelte';

  let { machine, example }: { machine: string; example: string } = $props();
</script>

<div class="empty">
  <div class="inner">
    <Mark size={56} />
    <h2>Nothing is served on {machine} yet</h2>
    <p class="lead">
      Add a project to give its dev server an address of its own, like <code>{example}</code>, that
      opens on this device.
    </p>
    <div class="buttons">
      <button type="button" class="primary" disabled aria-describedby="add-soon">
        <Icon name="plus" size={18} stroke={2} />Add project
      </button>
      <button type="button" class="secondary" disabled aria-describedby="add-soon">
        Add a server
      </button>
      <span class="soon" id="add-soon">Coming soon</span>
    </div>
    <p class="hint">
      Working with a coding agent? Run <code class="command">/nearhost add</code> in Claude Code,
      Codex or another agent on {machine}. Its request shows up here for you to approve.
    </p>
  </div>
</div>

<style>
  .empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 0 60px;
  }

  .inner {
    max-width: 520px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 18px;
  }

  h2 {
    margin: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-display);
    font-size: 30px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  .lead {
    margin: 0;
    color: var(--nh-body);
    font-size: 17px;
    line-height: 1.55;
  }

  code {
    font-family: var(--nh-font-mono);
    font-size: 15px;
    overflow-wrap: anywhere;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }

  .buttons button {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: var(--nh-radius-m);
    font: inherit;
    font-weight: 600;
  }

  .primary {
    background: var(--nh-accent);
    color: var(--nh-accent-ink);
  }

  .secondary {
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    color: var(--nh-text);
  }

  .buttons button:disabled {
    opacity: 0.5;
  }

  .soon {
    color: var(--nh-muted);
    font-size: 14px;
  }

  .hint {
    margin: 10px 0 0;
    padding: 16px 18px;
    border-radius: var(--nh-radius-l);
    background: var(--nh-surface);
    box-shadow: var(--pwa-card);
    color: var(--nh-muted);
    font-size: 15px;
    line-height: 1.55;
  }

  .command {
    color: var(--nh-text);
  }

  @media (max-width: 599px) {
    h2 {
      font-size: 24px;
    }

    .lead {
      font-size: 15px;
    }
  }
</style>
