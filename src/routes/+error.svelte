<script lang="ts">
  // Shown inside the shell (the root layout) for an unknown path, or a route that failed to load.
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
</script>

{#if page.status === 404}
  <h1>Page not found</h1>
  <p>Nothing in Nearhost lives at this address.</p>
{:else}
  <h1>Something went wrong</h1>
  <p>{page.error?.message ?? 'The page could not be shown.'}</p>
{/if}
<p><a href={resolve('/')}>Go to the overview</a></p>
