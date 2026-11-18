<script lang="ts">
	import { getSelectableCatalogReasons } from '$lib/os/reasons-catalog.svelte.js';
	import { STOPPAGE_REASONS } from '$lib/stoppage-reasons';
	import type { AppNavigation } from '../../lib/navigation';
	import StoppageReasonPicker from '../../components/StoppageReasonPicker.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	/** Catalog from machineSettings; empty → static STOPPAGE_REASONS (not mock jobs). */
	const reasons = $derived.by(() => {
		const catalog = getSelectableCatalogReasons();
		return catalog.length > 0 ? catalog : STOPPAGE_REASONS;
	});
</script>

<StoppageReasonPicker {navigation} {reasons} />
