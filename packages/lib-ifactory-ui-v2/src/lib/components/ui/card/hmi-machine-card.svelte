<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		hmiMachineCardAidClass,
		hmiMachineCardBadgeClass,
		hmiMachineCardBodyClass,
		hmiMachineCardDividerClass,
		hmiMachineCardEmptyClass,
		hmiMachineCardEmptyMessageClass,
		hmiMachineCardFieldClass,
		hmiMachineCardFieldLabelClass,
		hmiMachineCardFieldRowClass,
		hmiMachineCardFieldValueClass,
		hmiMachineCardFooterClass,
		hmiMachineCardHeaderClass,
		hmiMachineCardMainClass,
		hmiMachineCardMetricLabelClass,
		hmiMachineCardMetricStackClass,
		hmiMachineCardMetricsRowClass,
		hmiMachineCardNameClass,
		hmiMachineCardPrimaryMetricValueClass,
		hmiMachineCardRailClass,
		hmiMachineCardSecondaryMetricValueClass,
		hmiMachineCardShellClass,
		hmiMachineCardTimerLabelClass,
		hmiMachineCardTimerValueClass,
		hmiMachineCardTitleStackClass
	} from './hmi-machine-card.styles';
	import type { HmiMachineCardProps, HmiMachineCardTone } from './hmi-machine-card.types';

	const BADGE_VARIANT: Record<HmiMachineCardTone, 'online' | 'error' | 'offline' | 'loading'> = {
		online: 'online',
		error: 'error',
		offline: 'offline',
		loading: 'loading'
	};

	let {
		id,
		subtitle = '',
		tone,
		badge,
		fields = [],
		metrics = [],
		timer,
		emptyState,
		class: className = '',
		headerClass = '',
		bodyClass = '',
		footerClass = '',
		labelClass = '',
		valueClass = '',
		badgeClass = '',
		...rest
	}: HmiMachineCardProps = $props();

	const shellClasses = $derived(hmiMachineCardShellClass(className));
	const railClasses = $derived(hmiMachineCardRailClass(tone));
	const badgeClasses = $derived(hmiMachineCardBadgeClass(tone, badgeClass));
	const timerValueClasses = $derived(hmiMachineCardTimerValueClass(tone));
	const metaFields = $derived(fields.slice(0, 2));
	const metricFields = $derived(metrics.slice(0, 2));
	const isEmpty = $derived(Boolean(emptyState));
</script>

<div class={shellClasses} {...rest}>
	<div class={railClasses} aria-hidden="true"></div>
	<div class={hmiMachineCardMainClass}>
		<header class={hmiMachineCardHeaderClass(headerClass)}>
			<div class={hmiMachineCardTitleStackClass}>
				<p class={hmiMachineCardAidClass()}>{id}</p>
				{#if subtitle}
					<p class={hmiMachineCardNameClass()}>{subtitle}</p>
				{/if}
			</div>
			<Badge variant={BADGE_VARIANT[tone]} label={badge} dot={false} class={badgeClasses} />
		</header>

		<div class={hmiMachineCardDividerClass} role="presentation"></div>

		{#if !isEmpty}
			<div class={hmiMachineCardBodyClass(bodyClass)}>
				{#if metaFields.length > 0}
					<div class={hmiMachineCardFieldRowClass}>
						{#each metaFields as field, index (field.label + index)}
							<div class={hmiMachineCardFieldClass}>
								<span class={hmiMachineCardFieldLabelClass(labelClass)}>{field.label}</span>
								<span class={hmiMachineCardFieldValueClass(valueClass)}>{field.value}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if metricFields.length > 0}
					<div class={hmiMachineCardMetricsRowClass}>
						{#each metricFields as field, index (field.label + index)}
							<div class={hmiMachineCardMetricStackClass}>
								<span class={hmiMachineCardMetricLabelClass(labelClass)}>{field.label}</span>
								<span
									class={index === 0
										? hmiMachineCardPrimaryMetricValueClass(valueClass)
										: hmiMachineCardSecondaryMetricValueClass(valueClass)}
								>
									{field.value}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			{#if timer}
				<footer class={hmiMachineCardFooterClass(footerClass)}>
					<span class={hmiMachineCardTimerLabelClass(labelClass)}>{timer.label}</span>
					<span class={timerValueClasses}>{timer.value}</span>
				</footer>
			{/if}
		{:else if emptyState}
			<div class={hmiMachineCardEmptyClass()}>
				<p class={hmiMachineCardEmptyMessageClass()}>{emptyState.message}</p>
				{#if emptyState.onAction && emptyState.actionLabel}
					<Button
						variant="primary"
						label={emptyState.actionLabel}
						onclick={(e) => {
							e.stopPropagation();
							emptyState?.onAction?.();
						}}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>
