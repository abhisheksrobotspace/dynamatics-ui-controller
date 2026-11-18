<script lang="ts">
	import { Card } from '@ifactory/ui-v2';
	import type { PlanSummaryMetric } from '../lib/cutting-plan/planner-results';

	type Props = {
		metrics: PlanSummaryMetric[];
		class?: string;
	};

	let { metrics, class: className = '' }: Props = $props();
</script>

<div class="overflow-hidden rounded-none border border-border bg-surface {className}">
	<div class="flex flex-wrap divide-x divide-border">
		{#each metrics as metric (metric.label)}
			<Card
				class="min-w-32 flex-1 rounded-none border-0 shadow-none {metric.highlight === 'success'
					? 'bg-status-online/10'
					: 'bg-transparent'}"
				title={metric.label}
				content={metric.value}
				description={metric.sublabel}
				titleClass="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
				contentClass="text-lg font-semibold tabular-nums text-foreground"
				descriptionClass={metric.highlight === 'success'
					? 'text-xs text-status-online'
					: 'text-xs text-muted-foreground'}
			/>
		{/each}
	</div>
</div>
