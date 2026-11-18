<script lang="ts">
	import { Button, DateInput, Dialog, Label } from '@ifactory/ui-v2';
	import { dueDateDraftToIso, isoToDueDateDraft, validateDueDateDraft } from '../lib/due-dates.js';
	import type { DueDateEditTarget } from '../lib/create-plan-due-dates.js';

	let {
		open = $bindable(false),
		target = null,
		initialIso = null,
		saving = false,
		onConfirm
	}: {
		open?: boolean;
		target?: DueDateEditTarget | null;
		initialIso?: string | null;
		saving?: boolean;
		onConfirm?: (dueDateIso: string | null) => void;
	} = $props();

	let draft = $state('');
	let formError = $state('');

	const levelLabel = $derived(
		target?.level === 'release'
			? 'Release due date'
			: target?.level === 'structure'
				? 'Tower/stub due date'
				: 'Section due date'
	);

	$effect(() => {
		if (open) {
			draft = isoToDueDateDraft(initialIso);
			formError = '';
		}
	});

	function handleClear() {
		formError = '';
		onConfirm?.(null);
	}

	function handleSave() {
		formError = '';
		const error = validateDueDateDraft(draft, { required: false });
		if (error) {
			formError = error;
			return;
		}
		onConfirm?.(dueDateDraftToIso(draft));
	}
</script>

<Dialog bind:open title={levelLabel} hideFooter={true}>
	<div class="space-y-4 pt-2 pb-4">
		<p class="text-sm text-muted-foreground">{target?.label ?? ''}</p>
		{#if formError}
			<p class="text-sm text-destructive">{formError}</p>
		{/if}
		<div class="space-y-2">
			<Label for="plan-due-date-edit" text="Due date" />
			<DateInput id="plan-due-date-edit" bind:value={draft} class="w-full" disabled={saving} />
		</div>
		<p class="text-xs text-muted-foreground">
			Leave empty to inherit from a coarser level. Tower/section dates apply project-wide.
		</p>
	</div>
	<div class="flex items-center justify-end gap-3 border-t border-border pt-4">
		<Button variant="outline" label="Clear" disabled={saving} onclick={handleClear} />
		<Button variant="outline" label="Cancel" disabled={saving} onclick={() => (open = false)} />
		<Button
			variant="primary"
			label={saving ? 'Saving…' : 'Apply'}
			disabled={saving}
			onclick={handleSave}
			class="min-w-24"
		/>
	</div>
</Dialog>
