<script lang="ts">
	import KpiCard from './kpi-card.svelte';
	import { kpiCardStripClass } from './kpi-card.styles';
	import type { KpiCardItem } from './kpi-card.types';

	type Props = {
		items: KpiCardItem[];
		columns?: number;
		class?: string;
		cardClass?: string;
	};

	let { items, columns = 4, class: className = '', cardClass = '' }: Props = $props();
</script>

<div class={kpiCardStripClass(columns, className)}>
	{#each items as item, index (item.label)}
		<KpiCard
			label={item.label}
			value={item.value}
			icon={item.icon}
			valueTitle={item.valueTitle}
			{index}
			{columns}
			class={cardClass}
		/>
	{/each}
</div>
