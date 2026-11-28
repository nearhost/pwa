<script lang="ts">
  import { page } from '$app/state';

  const name = $derived(page.params.path?.split('/').filter(Boolean).at(-1) ?? 'Document');
</script>

<h1>{name}</h1>
<p>This document will appear here.</p>
