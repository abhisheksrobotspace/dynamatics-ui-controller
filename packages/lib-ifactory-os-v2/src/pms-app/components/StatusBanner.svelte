<script lang="ts">
	import { AlertTriangle, CheckCircle2, XCircle } from '@lucide/svelte';
	import { KeyValueCard, StatusBar, type StatusBarSegment } from '@ifactory/ui-v2';

	type Props = {
		variant?: 'stopped' | 'complete';
		title?: string;
		subtitle?: string;
		stoppedLabel?: string;
		timeLabel?: string;
		time?: string;
		tone?: 'online' | 'error';
		/** Right inset for the stopped-duration metric, so a trailing control can sit beside it. */
		metricClass?: string;
		class?: string;
	};

	let {
		variant = 'stopped',
		title = 'Production Stopped',
		subtitle = '',
		stoppedLabel = 'Stopped for',
		timeLabel = 'Completed at',
		time = '00:00:00',
		tone = 'error',
		metricClass = '',
		class: className = ''
	}: Props = $props();

	const isComplete = $derived(variant === 'complete');
	const isOnline = $derived(tone === 'online');
	const indicatorSegment = $derived<StatusBarSegment>(
		isComplete ? (isOnline ? 'online' : 'error') : 'error'
	);
</script>

<div
	role="status"
	class="relative box-border flex h-[73px] w-full items-center bg-background {className}"
>
	<StatusBar
		segments={[indicatorSegment]}
		size="default"
		class="absolute inset-y-0 left-0 !h-full !w-2 !gap-0"
	/>

	{#if isComplete}
		<!-- Icon (left: 30px, 28px size) -->
		<div class="absolute left-[30px] top-1/2 -translate-y-1/2 flex items-center">
			{#if isOnline}
				<CheckCircle2
					class="size-[28px] shrink-0 text-status-online stroke-[2.33]"
					aria-hidden="true"
				/>
			{:else}
				<XCircle class="size-[28px] shrink-0 text-status-error stroke-[2.33]" aria-hidden="true" />
			{/if}
		</div>

		<!-- Title & Subtitle (left: 73px) -->
		<div class="absolute left-[73px] top-[7.5px] bottom-[9.5px] flex flex-col justify-between">
			<span
				class="font-heading text-[28px] font-bold leading-[35px] uppercase tracking-normal {isOnline
					? 'text-status-online'
					: 'text-status-error'}"
			>
				{title}
			</span>
			{#if subtitle}
				<span class="font-heading text-[15px] font-bold leading-[22px] text-muted-foreground">
					{subtitle}
				</span>
			{/if}
		</div>

		<!-- Right Side Metric composed with KeyValueCard -->
		<KeyValueCard
			label={timeLabel}
			value={time}
			class="ml-auto mr-[38.7px] box-border flex w-auto min-h-0 items-center gap-[10px] border-0 bg-transparent p-0 shadow-none"
			labelClass="font-heading text-sm font-bold uppercase tracking-[0.35px] text-muted"
			valueClass="font-body text-[30px] font-bold leading-none tabular-nums text-foreground"
		/>
	{:else}
		<!-- Centered Title + Warning Icon (stopped variant) -->
		<div class="absolute left-1/2 -translate-x-1/2 flex items-center gap-[15px]">
			<AlertTriangle
				class="size-[28px] shrink-0 text-status-error stroke-[2.33]"
				aria-hidden="true"
			/>
			<span
				class="font-heading text-[28px] font-bold leading-[35px] uppercase tracking-normal text-status-error"
			>
				{title}
			</span>
		</div>

		<!-- Right Side Duration Metric composed with KeyValueCard -->
		<KeyValueCard
			label={stoppedLabel}
			value={time}
			class="ml-auto box-border flex w-auto min-h-0 items-center gap-3 border-0 bg-transparent p-0 shadow-none {metricClass ||
				'mr-8'}"
			labelClass="font-heading text-sm font-bold uppercase tracking-[0.35px] text-muted"
			valueClass="font-body text-[30px] font-bold leading-none tabular-nums text-status-error"
		/>
	{/if}
</div>
