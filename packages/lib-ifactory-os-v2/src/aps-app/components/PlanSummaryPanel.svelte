<script lang="ts">
	import { Button, Skeleton } from '@ifactory/ui-v2';
	import { formatMtNumber } from '../lib/create-plan.utils.js';
	import { computeCurrentLoadingPct, computeMaxLoadingMt } from '../lib/plant-capacity.js';

	let {
		loading = false,
		readonly = false,
		saving = false,
		saveDisabled = false,
		planInfo = null,
		currentMt = 0,
		capacityMt = null,
		maxLoadingPct = null,
		onCancel,
		onSave
	}: {
		loading?: boolean;
		readonly?: boolean;
		saving?: boolean;
		saveDisabled?: boolean;
		planInfo?: { name: string; month: string } | null;
		/** Selected DS weight (Current MT); null when any selected leaf has unknown weight. */
		currentMt?: number | null;
		capacityMt?: number | null;
		/** Plant max loading %. */
		maxLoadingPct?: number | null;
		onCancel: () => void;
		onSave?: () => void;
	} = $props();

	const maxMt = $derived(computeMaxLoadingMt(capacityMt, maxLoadingPct));
	const currentPct = $derived(
		currentMt == null ? null : computeCurrentLoadingPct(currentMt, maxMt)
	);
	const overMax = $derived(maxMt != null && currentMt != null && currentMt > maxMt + 1e-9);

	function formatPct(value: number | null | undefined): string {
		if (value == null || !Number.isFinite(value)) return '-';
		return `${value.toLocaleString('en-IN', {
			minimumFractionDigits: 0,
			maximumFractionDigits: 1
		})}%`;
	}
</script>

<div class="flex w-full max-w-[320px] shrink-0 flex-col gap-6">
	{#if loading}
		<div class="space-y-5 border border-border bg-background p-6">
			<Skeleton class="h-7 w-32" />
			<div class="space-y-3">
				<div class="flex min-w-0 items-start justify-between gap-4">
					<Skeleton class="h-4 w-20 shrink-0" />
					<Skeleton class="h-4 w-36" />
				</div>
				<div class="flex min-w-0 items-start justify-between gap-4">
					<Skeleton class="h-4 w-20 shrink-0" />
					<Skeleton class="h-4 w-28" />
				</div>
			</div>
		</div>

		<div class="space-y-5 border border-border bg-background p-6">
			<Skeleton class="h-7 w-40" />
			<div class="space-y-3">
				{#each Array.from({ length: 4 }) as _, index (`load-${index}-${_}`)}
					<div class="flex min-w-0 items-start justify-between gap-4">
						<Skeleton class="h-4 w-28 shrink-0" />
						<Skeleton class="h-4 w-20" />
					</div>
				{/each}
			</div>
		</div>

		<div class="space-y-3">
			<Skeleton class="h-10 w-full" />
			<Skeleton class="h-10 w-full" />
		</div>
	{:else}
		{#if planInfo}
			<div class="space-y-5 border border-border bg-background p-6">
				<h3 class="text-lg font-bold text-foreground">Plan details</h3>
				<div class="space-y-3">
					<div class="flex min-w-0 items-start justify-between gap-4 text-sm">
						<span class="shrink-0 text-muted-foreground">Month</span>
						<span
							class="min-w-0 truncate text-right font-bold text-foreground"
							title={planInfo.month || '-'}>{planInfo.month || '-'}</span
						>
					</div>
					<div class="flex min-w-0 items-start justify-between gap-4 text-sm">
						<span class="shrink-0 text-muted-foreground">Name</span>
						<span
							class="min-w-0 truncate text-right font-bold text-foreground"
							title={planInfo.name}>{planInfo.name}</span
						>
					</div>
				</div>
			</div>
		{/if}

		<div class="space-y-5 border border-border bg-background p-6">
			<h3 class="text-lg font-bold text-foreground">Loading Information</h3>
			<div class="space-y-3">
				<div class="flex min-w-0 items-start justify-between gap-4 text-sm">
					<span class="shrink-0 text-muted-foreground">Current (MT)</span>
					<span
						class="min-w-0 truncate text-right font-bold {overMax
							? 'text-amber-700'
							: 'text-foreground'}"
					>
						{currentMt == null ? '-' : formatMtNumber(currentMt)}
					</span>
				</div>
				<div class="flex min-w-0 items-start justify-between gap-4 text-sm">
					<span class="shrink-0 text-muted-foreground">Current (%)</span>
					<span
						class="min-w-0 truncate text-right font-bold {overMax
							? 'text-amber-700'
							: 'text-foreground'}"
					>
						{formatPct(currentPct)}
					</span>
				</div>
				<div class="flex min-w-0 items-start justify-between gap-4 text-sm">
					<span class="shrink-0 text-muted-foreground">Max (MT)</span>
					<span class="min-w-0 truncate text-right font-bold text-foreground">
						{maxMt == null ? '-' : formatMtNumber(maxMt)}
					</span>
				</div>
				<div class="flex min-w-0 items-start justify-between gap-4 text-sm">
					<span class="shrink-0 text-muted-foreground">Max (%)</span>
					<span class="min-w-0 truncate text-right font-bold text-foreground"
						>{formatPct(maxLoadingPct)}</span
					>
				</div>
				{#if overMax && maxMt != null && currentMt != null}
					<p class="text-[13px] leading-[17px] text-amber-700">
						Current loading ({formatMtNumber(currentMt)} MT) exceeds max ({formatMtNumber(maxMt)} MT).
						You can still save and run schedule.
					</p>
				{/if}
			</div>
		</div>

		<div class="space-y-3">
			{#if !readonly}
				<Button
					variant="primary"
					size="md"
					label={saving ? 'Saving…' : 'Save'}
					class="w-full justify-center font-bold"
					disabled={saving || saveDisabled}
					onclick={() => onSave?.()}
				/>
			{/if}
			<Button
				variant={readonly ? 'primary' : 'outline'}
				size="md"
				label={readonly ? 'Back' : 'Cancel'}
				class="w-full justify-center font-bold"
				onclick={onCancel}
			/>
		</div>
	{/if}
</div>
