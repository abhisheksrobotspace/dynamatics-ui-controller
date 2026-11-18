<script lang="ts">
	let { currentRoute } = $props();
</script>

<div class="flex items-center gap-4">
	<span class="text-sm text-gray-500 font-medium">Sample App Status: Online</span>
	{#if currentRoute === 'Reports'}
		<button
			class="px-3 py-1.5 bg-orange-500 text-white text-sm font-semibold rounded-md hover:bg-orange-600 transition-colors"
		>
			Export PDF
		</button>
	{/if}
</div>
