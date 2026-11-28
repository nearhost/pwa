<script lang="ts">
  // A project's change request. The core, the skill and agents hand out links to /change/<project>,
  // so this page always loads: on a change that is gone it says it is no longer waiting.
  import { page } from '$app/state';
  import ChangeRequest from '#lib/approvals/ChangeRequest.svelte';

  const name = $derived(page.params.name ?? '');
</script>

{#key name}<ChangeRequest {name} />{/key}
