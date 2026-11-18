<script lang="ts">
	import IFactoryOS from '$lib/os/IFactoryOS.svelte';
	import { apps, flavor } from '$osFlavor';
</script>

<IFactoryOS {apps} {flavor} />
