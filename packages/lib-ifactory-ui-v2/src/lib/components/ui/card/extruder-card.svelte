<script lang="ts">
	import { ProgressMeter } from '$lib/components/ui/progress-meter';
	import {
		extruderCardBarCellClass,
		extruderCardBarSpacerClass,
		extruderCardBodyClass,
		extruderCardCellClass,
		extruderCardChipClass,
		extruderCardChipUnitClass,
		extruderCardChipValueClass,
		extruderCardClass,
		extruderCardCornerHeadClass,
		extruderCardDividerCellClass,
		extruderCardDividerClass,
		extruderCardHeaderClass,
		extruderCardHeaderInnerClass,
		extruderCardHeaderRowClass,
		extruderCardMetricLabelClass,
		extruderCardMetricStackClass,
		extruderCardMetricUnitClass,
		extruderCardMetricValueClass,
		extruderCardMetricsRowClass,
		extruderCardRowLabelClass,
		extruderCardSetCellClass,
		extruderCardSetLabelClass,
		extruderCardSetValueClass,
		extruderCardTableClass,
		extruderCardTableWrapClass,
		extruderCardTitleClass,
		extruderCardZoneHeadClass
	} from './extruder-card.styles';
	import {
		barPercent,
		fillToneByVariant,
		getTempVariant,
		resolveExtruderTempThresholds
	} from './extruder-card.utils';
	import type { ExtruderTempThresholds } from './extruder-card.types';

	type Props = {
		name: string;
		rpm: number;
		current: number;
		actual: number[];
		set: number[];
		/** Override zone chip tone bands. Merged with demo defaults (±10 °C). */
		tempThresholds?: Partial<ExtruderTempThresholds>;
		class?: string;
	};

	let { name, rpm, current, actual, set, tempThresholds, class: className = '' }: Props = $props();

	const zones = $derived(
		Array.from({ length: Math.max(actual.length, set.length) }, (_, index) => `Zone ${index + 1}`)
	);

	const thresholds = $derived(resolveExtruderTempThresholds(tempThresholds));
	const rootClasses = $derived(extruderCardClass(className));
</script>

<section class={rootClasses}>
	<div class={extruderCardHeaderClass}>
		<div class={extruderCardHeaderInnerClass}>
			<div>
				<h2 class={extruderCardTitleClass}>{name}</h2>
				<div class={extruderCardMetricsRowClass}>
					<div class={extruderCardMetricStackClass}>
						<span class={extruderCardMetricLabelClass}>RPM</span>
						<span class={extruderCardMetricValueClass}>
							{rpm}<span class={extruderCardMetricUnitClass}>rpm</span>
						</span>
					</div>
					<div class={extruderCardMetricStackClass}>
						<span class={extruderCardMetricLabelClass}>Current</span>
						<span class={extruderCardMetricValueClass}>
							{current}<span class={extruderCardMetricUnitClass}>A</span>
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class={extruderCardBodyClass}>
		<div class={extruderCardTableWrapClass}>
			<table class={extruderCardTableClass}>
				<thead>
					<tr class={extruderCardHeaderRowClass}>
						<th class={extruderCardCornerHeadClass}></th>
						{#each zones as zone (zone)}
							<th class={extruderCardZoneHeadClass}>
								{zone}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<tr>
						<td class={extruderCardRowLabelClass}>Actual</td>
						{#each actual as val, i (zones[i] ?? i)}
							{@const variant = getTempVariant(val, set[i] ?? 0, thresholds)}
							<td class={extruderCardCellClass}>
								<div class={extruderCardChipClass(variant)}>
									<span class={extruderCardChipValueClass}>{val}</span>
									<span class={extruderCardChipUnitClass}>°C</span>
								</div>
							</td>
						{/each}
					</tr>

					<tr>
						<td class={extruderCardBarSpacerClass}></td>
						{#each actual as val, i (zones[i] ?? `bar-${i}`)}
							{@const variant = getTempVariant(val, set[i] ?? 0, thresholds)}
							{@const pct = barPercent(val, set[i] ?? 0, thresholds)}
							<td class={extruderCardBarCellClass}>
								<ProgressMeter
									value={pct}
									max={100}
									fillTone={fillToneByVariant[variant]}
									remainderTone="offline"
									ariaLabel={`${zones[i] ?? `Zone ${i + 1}`} actual vs set`}
									class="w-full"
								/>
							</td>
						{/each}
					</tr>

					<tr>
						<td colspan={zones.length + 1} class={extruderCardDividerCellClass}>
							<div class={extruderCardDividerClass}></div>
						</td>
					</tr>

					<tr>
						<td class={extruderCardSetLabelClass}>Set</td>
						{#each set as val, i (zones[i] ?? `set-${i}`)}
							<td class={extruderCardSetCellClass}>
								<span class={extruderCardSetValueClass}>{val}</span>
							</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</section>
