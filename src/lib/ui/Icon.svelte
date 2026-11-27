<script lang="ts" module>
  // The app's one icon set (the canvas's), drawn in currentColor. Stroke 1.5 beside regular text,
  // 2 beside semibold labels and on icon-only toolbar buttons.
  const paths = {
    overview: [
      'M4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3z',
      'M15.5 3h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3z',
      'M4.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14z',
      'M15.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z',
    ],
    waiting: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'M12 7v5l3 2'],
    document: ['M6 3h8l4 4v14H6z', 'M14 3v4h4M9 12h6M9 16h6'],
    device: [
      'M7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19.5v-15A2.5 2.5 0 0 1 7.5 2z',
      'M11 18h2',
    ],
    plus: ['M12 5v14M5 12h14'],
    search: ['M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0z', 'm20 20-3.5-3.5'],
    frame: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 9h18'],
    external: ['M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
    back: ['m15 5-7 7 7 7'],
    forward: ['m9 5 7 7-7 7'],
    reload: ['M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'],
    lock: [
      'M7 10h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z',
      'M8 10V7a4 4 0 0 1 8 0v3',
    ],
    fill: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
    tablet: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'],
    phone: ['M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'],
    refused: [
      'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
      'M3 9h18M4 21 20 3',
    ],
    check: ['m5 12 5 5 9-10'],
    down: ['m7 10 5 5 5-5'],
    code: ['m8 9-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12'],
    server: [
      'M5 4h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
      'M5 13h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z',
      'M7 7.5h.01M7 16.5h.01',
    ],
    port: ['M4 12h11M11 8l4 4-4 4', 'M19 5v14'],
    share: ['M12 3v12M7 8l5-5 5 5', 'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'],
    offline: [
      'M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0',
      'M12 19h.01M3 3l18 18',
    ],
  } as const;

  // Shapes drawn filled rather than stroked.
  const filled = {
    stop: 'M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    start: 'M8 5v14l11-7z',
  } as const;

  export type IconName = keyof typeof paths | keyof typeof filled;
</script>

<script lang="ts">
  let {
    name,
    size = 20,
    stroke = 1.5,
  }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  aria-hidden="true"
  focusable="false"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {#if name in filled}
    <path d={filled[name as keyof typeof filled]} fill="currentColor" stroke="none" />
  {:else}
    {#each paths[name as keyof typeof paths] as d (d)}
      <path {d} />
    {/each}
  {/if}
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
