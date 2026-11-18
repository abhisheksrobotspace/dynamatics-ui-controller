<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { Button, Textarea } from '@ifactory/ui-v2';
	import { normalizeAnalysis } from '../../lib/constants.js';
	import { updateTicket } from '../../lib/tickets.api.js';
	import { formatErrorMessage } from '../../lib/errors.js';
	import { pushErrorToast, pushSuccessToast } from '../../lib/toast.js';
	import type { MaintenanceTicket } from '../../lib/types.js';

	const MAX_WHYS = 5;

	type Props = {
		ticket: MaintenanceTicket;
		onChanged: () => void;
	};

	let { ticket, onChanged }: Props = $props();

	let isEditing = $state(false);
	let isSaving = $state(false);
	let draftWhys = $state<string[]>(['']);

	const whys = $derived(normalizeAnalysis(ticket.metadata).whys);
	const hasContent = $derived(whys.some((why) => why.trim()));

	function startEditing() {
		draftWhys = [...whys];
		isEditing = true;
	}

	function addWhy() {
		if (draftWhys.length >= MAX_WHYS) return;
		draftWhys = [...draftWhys, ''];
	}

	function removeWhy(index: number) {
		const next = draftWhys.filter((_, i) => i !== index);
		draftWhys = next.length > 0 ? next : [''];
	}

	async function save() {
		isSaving = true;
		try {
			const metadata = {
				...ticket.metadata,
				analysis: {
					// Preserve the fields owned by the Breakdown Analysis card.
					...normalizeAnalysis(ticket.metadata),
					whys: draftWhys.map((why) => why.trim()).filter(Boolean)
				}
			};
			await updateTicket(ticket.id, { metadata });
			isEditing = false;
			pushSuccessToast({ title: 'Why Analysis saved.' });
			onChanged();
		} catch (error) {
			pushErrorToast({
				title: 'Failed to save Why Analysis',
				description: formatErrorMessage(error)
			});
		} finally {
			isSaving = false;
		}
	}
</script>

<section class="overflow-hidden border border-border bg-surface text-foreground">
	<div class="flex items-center justify-between gap-3 px-4 pt-4">
		<h3 class="font-heading text-base font-semibold">Why Analysis</h3>
		{#if isEditing}
			<div class="flex gap-2">
				<Button
					size="sm"
					variant="outline"
					label="Cancel"
					disabled={isSaving}
					onclick={() => (isEditing = false)}
				/>
				<Button size="sm" label="Save" loading={isSaving} onclick={save} />
			</div>
		{:else}
			<Button size="sm" label={hasContent ? 'Edit' : 'Add'} onclick={startEditing} />
		{/if}
	</div>

	<div class="flex flex-col gap-4 px-4 pt-3 pb-4">
		{#each isEditing ? draftWhys : whys as why, index (index)}
			<div class="flex gap-3">
				<div
					class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary"
				>
					{index + 1}
				</div>
				<div class="flex flex-1 flex-col gap-2">
					<p class="text-sm font-semibold text-foreground">Why-{index + 1}</p>
					{#if isEditing}
						<Textarea
							bind:value={draftWhys[index]}
							placeholder={`Enter Why-${index + 1}`}
							rows={2}
						/>
					{:else}
						<p
							class="min-h-12 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
						>
							{why || '-'}
						</p>
					{/if}
				</div>
				{#if isEditing}
					<Button
						variant="ghost"
						size="icon"
						icon={Trash2}
						aria-label={`Remove Why-${index + 1}`}
						class="mt-7 size-8"
						iconClass="size-4"
						onclick={() => removeWhy(index)}
					/>
				{/if}
			</div>
		{/each}

		{#if isEditing}
			<div class="flex justify-end">
				<Button
					size="sm"
					label="Add Why"
					disabled={draftWhys.length >= MAX_WHYS}
					onclick={addWhy}
				/>
			</div>
		{/if}
	</div>
</section>
