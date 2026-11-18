<script lang="ts">
	import { Button, Input, Textarea } from '@ifactory/ui-v2';
	import { normalizeAnalysis } from '../../lib/constants.js';
	import { updateTicket } from '../../lib/tickets.api.js';
	import { formatErrorMessage } from '../../lib/errors.js';
	import { pushErrorToast, pushSuccessToast } from '../../lib/toast.js';
	import type { MaintenanceTicket } from '../../lib/types.js';

	type Props = {
		ticket: MaintenanceTicket;
		onChanged: () => void;
	};

	let { ticket, onChanged }: Props = $props();

	let isEditing = $state(false);
	let isSaving = $state(false);
	// Seeded from the ticket when editing starts (see startEditing).
	let draft = $state(normalizeAnalysis(null));

	const analysis = $derived(normalizeAnalysis(ticket.metadata));
	const hasContent = $derived(
		Boolean(
			analysis.partAssembly.trim() ||
			analysis.problem.trim() ||
			analysis.rootCause.trim() ||
			analysis.correctiveAction.trim()
		)
	);

	function startEditing() {
		draft = normalizeAnalysis(ticket.metadata);
		isEditing = true;
	}

	async function save() {
		isSaving = true;
		try {
			const metadata = {
				...ticket.metadata,
				analysis: {
					// Preserve the whys owned by the Why Analysis card.
					...normalizeAnalysis(ticket.metadata),
					partAssembly: draft.partAssembly.trim(),
					problem: draft.problem.trim(),
					rootCause: draft.rootCause.trim(),
					correctiveAction: draft.correctiveAction.trim()
				}
			};
			await updateTicket(ticket.id, { metadata });
			isEditing = false;
			pushSuccessToast({ title: 'Analysis details saved.' });
			onChanged();
		} catch (error) {
			pushErrorToast({ title: 'Failed to save analysis', description: formatErrorMessage(error) });
		} finally {
			isSaving = false;
		}
	}
</script>

<section class="overflow-hidden border border-border bg-surface text-foreground">
	<div class="flex items-center justify-between gap-3 px-4 pt-4">
		<h3 class="font-heading text-base font-semibold">Breakdown Analysis</h3>
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
		<div class="flex flex-col gap-2">
			<p class="text-sm font-medium text-foreground">Part Assembly</p>
			{#if isEditing}
				<Input bind:value={draft.partAssembly} placeholder="Enter part assembly" />
			{:else}
				<p class="min-h-9 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
					{analysis.partAssembly || '-'}
				</p>
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<p class="text-sm font-medium text-foreground">Problem</p>
			{#if isEditing}
				<Input bind:value={draft.problem} placeholder="Enter problem" />
			{:else}
				<p class="min-h-9 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
					{analysis.problem || '-'}
				</p>
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<p class="text-sm font-medium text-foreground">Root Cause</p>
			{#if isEditing}
				<Textarea bind:value={draft.rootCause} placeholder="Describe the root cause" rows={3} />
			{:else}
				<p class="min-h-16 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
					{analysis.rootCause || '-'}
				</p>
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<p class="text-sm font-medium text-foreground">Corrective Action</p>
			{#if isEditing}
				<Textarea
					bind:value={draft.correctiveAction}
					placeholder="Describe the corrective action"
					rows={3}
				/>
			{:else}
				<p class="min-h-16 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
					{analysis.correctiveAction || '-'}
				</p>
			{/if}
		</div>
	</div>
</section>
