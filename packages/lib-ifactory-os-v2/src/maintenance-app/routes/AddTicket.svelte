<script lang="ts">
	import AddTicketDialog from '../components/AddTicketDialog.svelte';

	let { params = {} }: { params?: Record<string, string> } = $props();

	const ticketId = $derived(params.ticketId ? Number(params.ticketId) : null);
	let open = $state(true);

	function goBack() {
		window.location.hash = '#/Maintenance/Tickets';
	}
</script>

<!-- Deep-link / edit route: show the same dialog used from the ticket list. -->
<AddTicketDialog bind:open {ticketId} onSaved={goBack} onClose={goBack} />
