<script lang="ts">
	import { Button, Dialog, Input, Label } from '@ifactory/ui-v2';
	import { AlertTriangle } from '@lucide/svelte';
	import type { LengthGroup } from '../../project-management-app/lib/store.svelte.js';
	import {
		canSaveLengthGroupDraft,
		findDuplicateLengthGroupName,
		findOverlappingLengthGroup,
		formatLengthGroupOverlapMessage,
		getLengthGroupFieldErrors,
		type LengthGroupDraft
	} from '../lib/cutting-plan/length-groups';

	interface Props {
		open?: boolean;
		draft: LengthGroupDraft;
		editingGroupId?: string | null;
		groups: LengthGroup[];
		onSave?: () => void;
	}

	let {
		open = $bindable(false),
		draft = $bindable(),
		editingGroupId = null,
		groups,
		onSave
	}: Props = $props();

	const fieldErrors = $derived(getLengthGroupFieldErrors(draft));
	const overlap = $derived(findOverlappingLengthGroup(draft, groups, editingGroupId));
	const duplicateName = $derived(findDuplicateLengthGroupName(draft.name, groups, editingGroupId));
	const canSave = $derived(canSaveLengthGroupDraft(draft, groups, editingGroupId));

	const dialogTitle = $derived(editingGroupId ? 'Edit Length Group' : 'Add Length Group');

	function handleSave() {
		if (!canSave) return;
		onSave?.();
		open = false;
	}

	function handleCancel() {
		open = false;
	}
</script>

<Dialog
	bind:open
	title={dialogTitle}
	size="md"
	hideFooter
	onConfirm={handleSave}
	class="flex max-h-[90vh] flex-col overflow-hidden"
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
		{#if overlap}
			<div
				class="flex items-start gap-3 rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-foreground"
				role="alert"
			>
				<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
				<p>{formatLengthGroupOverlapMessage(overlap)}</p>
			</div>
		{/if}
		{#if duplicateName}
			<div
				class="flex items-start gap-3 rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-foreground"
				role="alert"
			>
				<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
				<p>A group named “{draft.name.trim()}” already exists.</p>
			</div>
		{/if}

		<div class="space-y-2">
			<Label for="lengthGroupName" text="Group name" required />
			<Input
				id="lengthGroupName"
				bind:value={draft.name}
				placeholder="e.g. Short"
				error={Boolean(fieldErrors.name)}
				autofocus
			/>
		</div>

		<div class="space-y-2">
			<Label text="Part length range (mm)" />
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="minLength" text="Min" class="text-xs font-normal text-muted-foreground" />
					<Input
						id="minLength"
						type="number"
						min="0"
						bind:value={draft.minLength}
						error={Boolean(fieldErrors.minLength)}
					/>
				</div>
				<div class="space-y-1">
					<Label for="maxLength" text="Max" class="text-xs font-normal text-muted-foreground" />
					<Input
						id="maxLength"
						type="number"
						min="0"
						bind:value={draft.maxLength}
						error={Boolean(fieldErrors.maxLength)}
					/>
				</div>
			</div>
		</div>
	</div>

	<div class="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-white px-6 py-4">
		<Button variant="outline" label="Cancel" class="w-full" onclick={handleCancel} />
		<Button
			variant="primary"
			label="Save"
			class="w-full"
			disabled={!canSave}
			onclick={handleSave}
		/>
	</div>
</Dialog>
