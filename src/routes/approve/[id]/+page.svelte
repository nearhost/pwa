<script lang="ts">
  // One agent's request. The core, the skill and agents hand out links to /approve/<id>, so this
  // page always loads: on a request that is gone it says it is no longer waiting.
  import { page } from '$app/state';
  import Request from '#lib/approvals/Request.svelte';

  const id = $derived(page.params.id ?? '');
</script>

{#key id}<Request {id} />{/key}
