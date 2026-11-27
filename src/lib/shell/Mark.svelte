<script lang="ts">
  // The Nearhost mark (landing/brand/nearhost-mark-on-*.svg), coloured by the theme's tokens.
  let { size = 24 }: { size?: number } = $props();
</script>

<svg
  class="mark"
  viewBox="0 0 64 64"
  width={size}
  height={size}
  aria-hidden="true"
  focusable="false"
>
  <path
    d="M14 56V32a18 18 0 0 1 36 0v24"
    fill="none"
    stroke="var(--pwa-mark-arch)"
    stroke-width="11"
    stroke-linecap="round"
  />
  <circle cx="32" cy="48" r="6" fill="var(--pwa-mark-dot)" />
</svg>

<style>
  .mark {
    display: block;
    flex: none;
  }
</style>
