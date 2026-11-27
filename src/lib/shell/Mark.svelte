<script lang="ts">
  // The Nearhost mark (landing/brand/nearhost-mark-on-*.svg: a prompt, a chevron pointing at a dot), coloured by the theme's tokens.
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
    d="M13 17l15 15-15 15"
    fill="none"
    stroke="var(--nh-mark-chevron)"
    stroke-width="8"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="46" cy="44" r="7.5" fill="var(--nh-mark-dot)" />
</svg>

<style>
  .mark {
    display: block;
    flex: none;
  }
</style>
