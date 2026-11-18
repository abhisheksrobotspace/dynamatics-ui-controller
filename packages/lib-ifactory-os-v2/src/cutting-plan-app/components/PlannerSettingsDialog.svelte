<script lang="ts">
	import { untrack } from 'svelte';
	import { Dialog, Input, Label, Toggle } from '@ifactory/ui-v2';
	import { maxTimeLimitPerSection } from '../lib/cutting-plan/constants';
	import { createPlannerSettingsDraft } from '../lib/cutting-plan/planner-settings';
	import type { PlannerSettings } from '../../project-management-app/lib/store.svelte.js';

	interface Props {
		open?: boolean;
		settings: PlannerSettings;
		title?: string;
		confirmLabel?: string;
		onConfirm?: () => void;
	}

	let {
		open = $bindable(false),
		settings = $bindable(),
		title = 'Planner settings',
		confirmLabel = 'Save',
		onConfirm
	}: Props = $props();

	const maxTimeLimit = maxTimeLimitPerSection();
	/** Local draft — avoids mutating parent-owned `settings` while editing. */
	let draft = $state<PlannerSettings>(createPlannerSettingsDraft(''));
	/** Last value within the allowed range — restored when over-limit input is rejected. */
	let acceptedTimeLimit = $state(1);

	// Sync draft only when the dialog opens. `untrack` keeps settings/draft out of the
	// dependency graph so assigning draft cannot re-trigger this effect (effect_update_depth_exceeded).
	$effect(() => {
		if (!open) return;
		untrack(() => {
			draft = createPlannerSettingsDraft(settings.projectId, settings);
			const current = Number(draft.timeLimit);
			if (Number.isFinite(current) && current >= 1 && current <= maxTimeLimit) {
				acceptedTimeLimit = current;
			}
		});
	});

	function onTimeLimitBeforeInput(event: Event) {
		const inputEvent = event as InputEvent;
		if (
			inputEvent.inputType === 'deleteContentBackward' ||
			inputEvent.inputType === 'deleteContentForward' ||
			inputEvent.inputType === 'deleteByCut' ||
			inputEvent.inputType === 'deleteByDrag'
		) {
			return;
		}

		const input = event.currentTarget as HTMLInputElement;
		const data = inputEvent.data ?? '';
		const start = input.selectionStart ?? input.value.length;
		const end = input.selectionEnd ?? input.value.length;
		const next = `${input.value.slice(0, start)}${data}${input.value.slice(end)}`;
		if (next === '') return;

		const value = Number(next);
		if (Number.isFinite(value) && value > maxTimeLimit) {
			inputEvent.preventDefault();
		}
	}

	function onTimeLimitInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (input.value === '') return;

		const value = Number(input.value);
		if (!Number.isFinite(value) || value > maxTimeLimit) {
			draft.timeLimit = acceptedTimeLimit;
			input.value = String(acceptedTimeLimit);
			return;
		}

		if (value >= 1) {
			acceptedTimeLimit = value;
			draft.timeLimit = value;
		}
	}

	function handleConfirm() {
		settings = createPlannerSettingsDraft(settings.projectId, draft);
		onConfirm?.();
	}
</script>

<Dialog bind:open {title} size="md" cancelLabel="Cancel" {confirmLabel} onConfirm={handleConfirm}>
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="timeLimit" text="Time limit per section (s)" />
			<Input
				id="timeLimit"
				type="number"
				min="1"
				max={maxTimeLimit}
				autofocus
				bind:value={draft.timeLimit}
				onbeforeinput={onTimeLimitBeforeInput}
				oninput={onTimeLimitInput}
			/>
			<p class="text-red-500 text-sm">Max {maxTimeLimit}s per section.</p>
		</div>
		<div class="space-y-2">
			<Label for="maxLengthsBar" text="Max unique lengths per bar" />
			<Input id="maxLengthsBar" type="number" min="1" bind:value={draft.maxUniqueLengthsPerBar} />
		</div>
		<div class="space-y-2 sm:col-span-2">
			<Label for="maxLengthsSec" text="Max unique stock lengths per section (0 = no limit)" />
			<Input
				id="maxLengthsSec"
				type="number"
				min="0"
				bind:value={draft.maxUniqueStockLengthsPerSection}
			/>
		</div>
		<div class="flex items-center justify-between gap-4 sm:col-span-2">
			<Label for="enforceMarkCohesion" text="Unique markings use same bar length" />
			<Toggle
				id="enforceMarkCohesion"
				bind:checked={draft.enforceMarkCohesion}
				aria-label="Unique markings use same bar length"
			/>
		</div>
	</div>
</Dialog>
