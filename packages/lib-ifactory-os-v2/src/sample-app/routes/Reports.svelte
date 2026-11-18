<script lang="ts">
	let { params } = $props();
</script>

<div class="p-8">
	<h1 class="text-3xl font-bold font-manrope text-gray-800 mb-4">Reports</h1>
	<p class="text-gray-600">Viewing report for ID: {params?.id || 'All'}</p>
</div>
