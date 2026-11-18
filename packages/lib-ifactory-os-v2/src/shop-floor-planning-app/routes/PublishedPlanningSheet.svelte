<script lang="ts">
	import PlanningSheet from '../../central-planning-app/routes/PlanningSheet.svelte';

	let { params = {}, data }: { params?: Record<string, string>; data?: unknown } = $props();

	const shopFloorMonth = $derived(params.month ? decodeURIComponent(params.month) : '');
</script>

<PlanningSheet {params} {data} shopFloorLocal={true} {shopFloorMonth} />
