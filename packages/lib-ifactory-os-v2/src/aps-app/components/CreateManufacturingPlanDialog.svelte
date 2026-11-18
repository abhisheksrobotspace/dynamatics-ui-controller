<script lang="ts">
	import {
		Alert,
		Button,
		Combobox,
		Dialog,
		Input,
		Label,
		type ComboboxItem
	} from '@ifactory/ui-v2';
	import {
		currentLocalPlanMonth,
		dateFromPlanMonth,
		nextPlanId,
		planMonthOptions
	} from '../lib/create-plan.id.js';
	import { emptyPlanSummaryPayload } from '../lib/create-plan.utils.js';
	import { monthRangeFromPlanMonth } from '../lib/create-plan-ds.utils.js';
	import {
		createManufacturingPlan,
		listPlanIds,
		type ApsManufacturingPlanRow
	} from '../lib/plans.api.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { rememberManufacturingPlanLabel } from '../lib/manufacturing-plans.js';
	import { apsPushSuccessToast } from '../lib/toast.js';
	import { ddMmYyyyToOffsetIso } from '../lib/scheduler-datetime.js';
	import { DEFAULT_APS_PLANT_ID } from '../lib/aps-plant.constants.js';

	let {
		open = $bindable(false),
		onCreated
	}: {
		open?: boolean;
		onCreated?: (plan: ApsManufacturingPlanRow) => void;
	} = $props();

	const monthItems: ComboboxItem[] = planMonthOptions(new Date().getFullYear());

	let planName = $state('');
	let planMonth = $state(currentLocalPlanMonth());
	let formError = $state('');
	let saving = $state(false);

	function resetForm() {
		planName = '';
		planMonth = currentLocalPlanMonth();
		formError = '';
	}

	function dueDateIsoFromPlanMonth(month: string): string | null {
		const match = /^(\d{4})-(\d{2})-01$/.exec(month.trim());
		if (!match) return null;
		return ddMmYyyyToOffsetIso(`01/${match[2]}/${match[1]}`);
	}

	async function handleConfirm() {
		if (saving) return;
		formError = '';
		const nameTrimmed = planName.trim();
		if (!nameTrimmed) {
			formError = 'Enter a manufacturing plan name.';
			return;
		}

		const monthTrimmed = planMonth.trim();
		const monthAnchor = dateFromPlanMonth(monthTrimmed);
		if (!monthAnchor) {
			formError = 'Select a plan month.';
			return;
		}
		const dueDateIso = dueDateIsoFromPlanMonth(monthTrimmed);
		if (!dueDateIso) {
			formError = 'Select a plan month.';
			return;
		}

		const period = monthRangeFromPlanMonth(monthTrimmed);
		if (!period) {
			formError = 'Select a plan month.';
			return;
		}

		saving = true;
		try {
			const existingIds = await listPlanIds();
			const planId = nextPlanId(existingIds, monthAnchor);
			const plan = await createManufacturingPlan({
				planId,
				name: nameTrimmed,
				month: monthTrimmed,
				periodStart: period.startDate,
				periodEnd: period.endDate,
				dueDate: dueDateIso,
				plantId: DEFAULT_APS_PLANT_ID,
				summary: emptyPlanSummaryPayload()
			});
			rememberManufacturingPlanLabel(planId, nameTrimmed);
			open = false;
			resetForm();
			apsPushSuccessToast({ title: 'Manufacturing plan created' });
			onCreated?.(plan);
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		if (!open && !saving) resetForm();
	});
</script>

<Dialog bind:open title="Create Manufacturing Plan" hideFooter={true}>
	<div class="space-y-4 pt-2 pb-4">
		{#if formError}
			<Alert variant="error" title="Could not create plan" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="create-plan-name" text="Name" required />
			<Input
				id="create-plan-name"
				autofocus
				bind:value={planName}
				placeholder="Enter plan name..."
				disabled={saving}
			/>
		</div>
		<div class="space-y-2">
			<Label for="create-plan-month" text="Month" required />
			<Combobox
				id="create-plan-month"
				items={monthItems}
				bind:value={planMonth}
				placeholder="Select month"
				searchPlaceholder="Search months..."
				emptyText="No months found."
				disabled={saving}
				triggerClass="w-full rounded-none"
			/>
		</div>
	</div>

	<div class="flex items-center justify-end gap-3 border-t border-border pt-4">
		<Button variant="outline" label="Cancel" disabled={saving} onclick={() => (open = false)} />
		<Button
			variant="primary"
			label={saving ? 'Creating…' : 'Create'}
			disabled={saving}
			onclick={handleConfirm}
			class="min-w-24"
		/>
	</div>
</Dialog>
