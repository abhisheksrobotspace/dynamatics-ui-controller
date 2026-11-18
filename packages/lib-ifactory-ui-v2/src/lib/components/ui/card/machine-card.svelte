<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Badge } from '$lib/components/ui/badge';
	import { StatusBar } from '$lib/components/ui/status-bar';
	import type { StatusBarSegment } from '$lib/components/ui/status-bar/status-bar.constants';
	import {
		cardContentClass,
		cardFooterClass,
		cardHeaderClass,
		cardHeaderDividedClass,
		cardShellClasses,
		cardTitleClass,
		type CardVariant
	} from './card.styles';

	type MachineStatus = Extract<CardVariant, 'error' | 'online' | 'offline' | 'loading'>;

	type Metric = {
		label: string;
		value: string;
		suffix?: string;
	};

	type BadgeConfig = {
		label?: string;
		variant?: MachineStatus;
	};

	type FooterConfig = {
		segments?: StatusBarSegment[];
	};

	type Props = {
		id: string;
		status: MachineStatus;
		gridMetrics?: [Metric, Metric];
		rowMetric?: Metric;
		showBadge?: boolean;
		badge?: BadgeConfig;
		showFooter?: boolean;
		footer?: FooterConfig;
		class?: string;
		headerClass?: string;
		contentClass?: string;
		footerClass?: string;
	};

	const statusLabels: Record<MachineStatus, string> = {
		error: 'Error',
		online: 'Online',
		offline: 'Offline',
		loading: 'Loading'
	};

	const defaultGridMetrics: [Metric, Metric] = [
		{ label: 'OEE', value: '0.00%' },
		{ label: 'Jobs', value: '0', suffix: 'completed' }
	];

	const defaultRowMetric: Metric = { label: 'Weight', value: '0 MT' };

	let {
		id,
		status,
		gridMetrics = defaultGridMetrics,
		rowMetric = defaultRowMetric,
		showBadge = true,
		badge,
		showFooter = true,
		footer,
		class: className = '',
		headerClass = '',
		contentClass = '',
		footerClass = ''
	}: Props = $props();

	const badgeLabel = $derived(badge?.label ?? statusLabels[status]);
	const badgeVariant = $derived(badge?.variant ?? status);
</script>

<div class={cardShellClasses(status, cn('flex h-full min-h-0 flex-col', className))}>
	<header
		class={cn(
			cardHeaderClass,
			cardHeaderDividedClass,
			'flex shrink-0 items-center justify-between gap-3',
			headerClass
		)}
	>
		<h3 class={cn(cardTitleClass, 'min-w-0 truncate')}>{id}</h3>
		{#if showBadge}
			<Badge variant={badgeVariant} label={badgeLabel} class="shrink-0" />
		{/if}
	</header>

	<div class={cn(cardContentClass, 'flex flex-1 flex-col space-y-4 pt-4', contentClass)}>
		<div class="grid grid-cols-2 gap-4">
			{#each gridMetrics as metric (metric.label)}
				<div class="min-w-0">
					<p class="truncate text-sm text-muted">{metric.label}</p>
					<p class="mt-1 truncate text-xl whitespace-nowrap">
						<span class="font-medium">{metric.value}</span>
						{#if metric.suffix}
							<span class="font-medium"> {metric.suffix}</span>
						{/if}
					</p>
				</div>
			{/each}
		</div>

		<div class="mt-auto flex items-center justify-between gap-3 text-base text-muted">
			<span class="shrink-0">{rowMetric.label}</span>
			<span class="min-w-0 truncate text-right">{rowMetric.value}</span>
		</div>
	</div>

	{#if showFooter}
		<footer class={cn(cardFooterClass, 'mt-auto shrink-0', footerClass)}>
			<StatusBar segments={footer?.segments} />
		</footer>
	{/if}
</div>
