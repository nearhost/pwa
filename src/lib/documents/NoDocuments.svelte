<script lang="ts">
  // No documents yet: what will show up here, in the canvas's words.
  import Icon from '#lib/ui/Icon.svelte';
</script>

<div class="empty">
  <span class="icon"><Icon name="document" size={44} /></span>
  <h2>No documents yet</h2>
  <p>
    When an agent using the Nearhost skill writes a plan, spec or report for you, it shows up here
    to read.
  </p>
</div>

<style>
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 36px 60px;
    text-align: center;
  }

  .icon {
    display: flex;
    color: var(--nh-muted);
  }

  h2 {
    margin: 0;
    color: var(--nh-text);
    font-family: var(--nh-font-display);
    font-size: 22px;
    font-weight: 600;
  }

  p {
    margin: 0;
    max-width: 420px;
    color: var(--nh-body);
    line-height: 1.55;
  }
</style>
