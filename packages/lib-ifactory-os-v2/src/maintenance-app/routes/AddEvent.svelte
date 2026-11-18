<script lang="ts">
	import AddEventDialog from '../components/AddEventDialog.svelte';

	let { params = {} }: { params?: Record<string, string> } = $props();

	const eventId = $derived(params.eventId ? Number(params.eventId) : null);
	let open = $state(true);

	function goBack() {
		window.location.hash = '#/Maintenance/Calendar';
	}
</script>

<!-- Deep-link / edit route: show the same dialog used from the calendar page. -->
<AddEventDialog bind:open {eventId} onSaved={goBack} onClose={goBack} />
