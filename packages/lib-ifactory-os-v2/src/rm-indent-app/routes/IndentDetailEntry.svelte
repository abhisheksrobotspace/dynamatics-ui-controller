<script lang="ts">
	import { isUiIndentId } from '../lib/ui-indent.store';
	import IndentDetail from './IndentDetail.svelte';
	import UiIndentDetail from './UiIndentDetail.svelte';

	let {
		params = {},
		data
	}: {
		params?: Record<string, string>;
		data?: unknown;
	} = $props();

	const indentId = $derived(params.indentId ? decodeURIComponent(params.indentId) : '');
</script>

{#if isUiIndentId(indentId)}
	<UiIndentDetail {params} />
{:else}
	<IndentDetail {params} {data} />
{/if}
