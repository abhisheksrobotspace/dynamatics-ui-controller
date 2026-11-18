<script lang="ts">
	import { getSelectableCatalogReasons } from '$lib/os/reasons-catalog.svelte.js';
	import type { AppNavigation } from '../../lib/navigation';
	import StoppageReasonPicker from '../../components/StoppageReasonPicker.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	const reasons = $derived(getSelectableCatalogReasons());
</script>

<StoppageReasonPicker {navigation} {reasons} />
