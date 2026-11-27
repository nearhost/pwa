<script lang="ts">
  // The core, the skill and agents hand out links to /change/<project>; this page must always load.
  import { page } from '$app/state';
</script>

<h1>Change to {page.params.name}</h1>
<p>The change this project's .nearhostrc asks for will appear here.</p>
