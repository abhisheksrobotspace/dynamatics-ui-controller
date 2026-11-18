<script lang="ts">
	import { ChevronDown, MoreVertical } from '@lucide/svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		tableActionsCellInnerClass,
		tableSkeletonActionButtonClass,
		tableSkeletonActionIconButtonClass,
		tableSkeletonActionIconClass,
		tableSkeletonBarClass,
		tableSkeletonBadgeClass,
		tableSkeletonCircleClass,
		tableSkeletonMultiBadgeChipClass,
		tableSkeletonMultiBadgeChipWidth,
		tableSkeletonMultiBadgeClass,
		tableSkeletonMultiBadgeLabelClass,
		tableSkeletonExpandButtonClass,
		tableSkeletonExpandIconClass,
		tableSkeletonExpandSpacerClass,
		tableSkeletonIndentStyle,
		tableSkeletonInputClass,
		tableSkeletonLeadingClass,
		tableSkeletonMetricBarClass,
		tableSkeletonMetricLabelClass,
		tableSkeletonSelectionClass,
		tableSkeletonTreeInnerClass,
		tableSkeletonTreeLabelClass
	} from './table.styles';

	export type TableSkeletonCellKind =
		| 'serial'
		| 'text'
		| 'badge'
		| 'multi-badge'
		| 'metric-bar'
		| 'actions'
		| 'action-button'
		| 'selection'
		| 'input'
		| 'tree';

	type Props = {
		kind?: TableSkeletonCellKind;
		rowIndex?: number;
		columnIndex?: number;
		depth?: number;
		hasChildren?: boolean;
		align?: 'start' | 'center' | 'end';
		showLeading?: boolean;
		labeledButtonCount?: number;
		iconButtonCount?: number;
		showMenu?: boolean;
		showBadgeLabel?: boolean;
		badgeCount?: number;
		/** Parent tree rows keep measure/action cells empty, matching real data. */
		showValue?: boolean;
	};

	let {
		kind = 'text',
		rowIndex = 0,
		columnIndex = 0,
		depth = 0,
		hasChildren = false,
		align = 'end',
		showLeading = false,
		labeledButtonCount = 0,
		iconButtonCount = 0,
		showMenu = false,
		showBadgeLabel = false,
		badgeCount = 2,
		showValue = true
	}: Props = $props();
</script>

{#if kind === 'tree'}
	<div class={tableSkeletonTreeInnerClass} style={tableSkeletonIndentStyle(depth)}>
		{#if hasChildren}
			<span class={tableSkeletonExpandButtonClass} aria-hidden="true">
				<ChevronDown class={tableSkeletonExpandIconClass} />
			</span>
		{:else}
			<span class={tableSkeletonExpandSpacerClass} aria-hidden="true"></span>
		{/if}
		<Skeleton class={tableSkeletonTreeLabelClass(depth, rowIndex)} />
	</div>
{:else if showValue && kind === 'serial'}
	<Skeleton class={tableSkeletonCircleClass} />
{:else if showValue && kind === 'selection'}
	<Skeleton class={tableSkeletonSelectionClass} />
{:else if showValue && kind === 'action-button'}
	<div class={tableActionsCellInnerClass(align)}>
		<Skeleton class={tableSkeletonActionButtonClass} />
	</div>
{:else if showValue && kind === 'actions'}
	<div class={tableActionsCellInnerClass(align)}>
		{#if showLeading}
			<Skeleton class={tableSkeletonLeadingClass} />
		{/if}
		{#each Array.from({ length: labeledButtonCount }, (_, index) => index) as buttonIndex (`labeled-${buttonIndex}`)}
			<Skeleton class={tableSkeletonActionButtonClass} />
		{/each}
		{#each Array.from({ length: iconButtonCount }, (_, index) => index) as buttonIndex (`icon-${buttonIndex}`)}
			<Skeleton class={tableSkeletonActionIconButtonClass} />
		{/each}
		{#if showMenu}
			<MoreVertical class={tableSkeletonActionIconClass} aria-hidden="true" />
		{/if}
		{#if labeledButtonCount === 0 && iconButtonCount === 0 && !showMenu && !showLeading}
			<Skeleton class={tableSkeletonActionButtonClass} />
		{/if}
	</div>
{:else if showValue && kind === 'metric-bar'}
	<div class="flex items-center gap-4">
		<Skeleton class={tableSkeletonMetricLabelClass} />
		<Skeleton class={tableSkeletonMetricBarClass} />
	</div>
{:else if showValue && kind === 'multi-badge'}
	<div class={tableSkeletonMultiBadgeClass}>
		{#if showBadgeLabel}
			<Skeleton class={tableSkeletonMultiBadgeLabelClass} />
		{/if}
		<div class="flex flex-wrap gap-1">
			{#each Array.from({ length: Math.max(badgeCount, 1) }, (_, index) => index) as badgeIndex (badgeIndex)}
				<Skeleton
					class="{tableSkeletonMultiBadgeChipClass} {tableSkeletonMultiBadgeChipWidth(badgeIndex)}"
				/>
			{/each}
		</div>
	</div>
{:else if showValue && kind === 'badge'}
	<Skeleton class={tableSkeletonBadgeClass} />
{:else if showValue && kind === 'input'}
	<Skeleton class={tableSkeletonInputClass} />
{:else if showValue}
	<Skeleton class={tableSkeletonBarClass(rowIndex, columnIndex)} />
{/if}
