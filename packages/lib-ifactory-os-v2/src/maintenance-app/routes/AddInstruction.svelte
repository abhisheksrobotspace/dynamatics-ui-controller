<script lang="ts">
	import AddInstructionDialog from '../components/AddInstructionDialog.svelte';

	let { params = {} }: { params?: Record<string, string> } = $props();

	const instructionId = $derived(params.instructionId ? Number(params.instructionId) : null);
	let open = $state(true);

	function goBack() {
		window.location.hash = '#/Maintenance/Instructions';
	}
</script>

<!-- Deep-link / edit route: show the same dialog used from the instructions list. -->
<AddInstructionDialog bind:open {instructionId} onSaved={goBack} onClose={goBack} />
