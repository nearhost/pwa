<script lang="ts">
  import type { Snippet } from 'svelte';
  import { appName } from '#lib';

  let { children }: { children: Snippet } = $props();
</script>

<header>
  <h1>{appName}</h1>
</header>

<main>
  {@render children()}
</main>
