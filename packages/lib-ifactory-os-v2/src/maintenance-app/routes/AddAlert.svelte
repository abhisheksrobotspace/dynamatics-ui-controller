<script lang="ts">
	import AddAlertDialog from '../components/AddAlertDialog.svelte';

	let { params = {} }: { params?: Record<string, string> } = $props();

	const alertId = $derived(params.alertId ? Number(params.alertId) : null);
	let open = $state(true);

	function goBack() {
		window.location.hash = '#/Maintenance/Alerts';
	}
</script>

<!-- Deep-link / edit route: show the same dialog used from the alerts list. -->
<AddAlertDialog bind:open {alertId} onSaved={goBack} onClose={goBack} />
