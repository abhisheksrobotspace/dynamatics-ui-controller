<script lang="ts">
	import { onMount } from 'svelte';
	import { Trash2 } from '@lucide/svelte';
	import { Button, Checkbox, ConfirmationDialog, Dialog, Skeleton } from '@ifactory/ui-v2';
	import { TICKET_STATUS } from '../../lib/constants.js';
	import {
		addTicketInstructions,
		listTicketInstructions,
		removeTicketInstruction,
		setTicketInstructionCompleted
	} from '../../lib/tickets.api.js';
	import { formatErrorMessage, isAbortError } from '../../lib/errors.js';
	import { pushErrorToast, pushSuccessToast } from '../../lib/toast.js';
	import type { Instruction, MaintenanceTicket, TicketInstruction } from '../../lib/types.js';

	type Props = {
		ticket: MaintenanceTicket;
		instructions: Instruction[];
	};

	let { ticket, instructions }: Props = $props();

	let rows = $state<TicketInstruction[]>([]);
	let isLoading = $state(true);

	const isClosed = $derived(ticket.status === TICKET_STATUS.CLOSED);
	const instructionById = $derived(new Map(instructions.map((row) => [row.id, row])));

	async function reload(signal?: AbortSignal) {
		rows = await listTicketInstructions(ticket.id, signal);
	}

	onMount(() => {
		const controller = new AbortController();
		reload(controller.signal)
			.catch((error) => {
				if (!isAbortError(error)) {
					pushErrorToast({
						title: 'Failed to load instructions',
						description: formatErrorMessage(error)
					});
				}
			})
			.finally(() => (isLoading = false));
		return () => controller.abort();
	});

	async function toggle(row: TicketInstruction) {
		const previous = row.is_completed;
		row.is_completed = !previous;
		try {
			await setTicketInstructionCompleted(row.id, row.is_completed);
		} catch (error) {
			row.is_completed = previous;
			pushErrorToast({ title: 'Status update failed', description: formatErrorMessage(error) });
		}
	}

	// --- Delete confirmation ---
	let rowPendingDelete = $state<TicketInstruction | null>(null);
	let isDeleteDialogOpen = $state(false);

	async function confirmDelete() {
		const target = rowPendingDelete;
		rowPendingDelete = null;
		if (!target) return;
		try {
			await removeTicketInstruction(target.id);
			rows = rows.filter((row) => row.id !== target.id);
			pushSuccessToast({ title: 'Instruction deleted.' });
		} catch (error) {
			pushErrorToast({ title: 'Delete failed', description: formatErrorMessage(error) });
		}
	}

	// --- Add dialog ---
	let isAddDialogOpen = $state(false);
	let selectedIds = $state<number[]>([]);
	let isAdding = $state(false);

	const availableInstructions = $derived.by(() => {
		const attached = new Set(rows.map((row) => row.instruction_id));
		return instructions.filter((row) => !attached.has(row.id));
	});

	function toggleSelection(id: number) {
		selectedIds = selectedIds.includes(id)
			? selectedIds.filter((value) => value !== id)
			: [...selectedIds, id];
	}

	async function confirmAdd() {
		if (selectedIds.length === 0) {
			isAddDialogOpen = false;
			return;
		}
		isAdding = true;
		try {
			await addTicketInstructions(ticket.id, selectedIds);
			await reload();
			selectedIds = [];
			isAddDialogOpen = false;
			pushSuccessToast({ title: 'Instructions added.' });
		} catch (error) {
			pushErrorToast({
				title: 'Failed to add instructions',
				description: formatErrorMessage(error)
			});
		} finally {
			isAdding = false;
		}
	}
</script>

<section class="overflow-hidden border border-border bg-surface text-foreground">
	<div class="flex items-center justify-between gap-3 px-4 pt-4">
		<h3 class="font-heading text-base font-semibold">Instructions</h3>
		<Button
			size="sm"
			label="Add"
			onclick={() => {
				selectedIds = [];
				isAddDialogOpen = true;
			}}
		/>
	</div>
	<div class="px-4 pt-3 pb-4">
		{#if isLoading}
			<div class="flex flex-col gap-2">
				<Skeleton class="h-10 w-full" />
				<Skeleton class="h-10 w-full" />
			</div>
		{:else if rows.length === 0}
			<p class="py-4 text-center text-sm text-muted-foreground">No instructions added yet.</p>
		{:else}
			<div class="flex flex-col divide-y divide-border">
				{#each rows as row (row.id)}
					{@const instruction = instructionById.get(row.instruction_id)}
					<div class="flex items-start gap-3 py-3">
						<Checkbox
							checked={row.is_completed}
							disabled={isClosed}
							onCheckedChange={() => void toggle(row)}
						/>
						<div class="flex flex-1 flex-col">
							<p class="text-sm font-medium text-foreground">
								{instruction?.instruction_text ?? `Instruction #${row.instruction_id}`}
							</p>
							<p class="text-xs text-muted-foreground">
								Duration: {instruction?.estimated_duration_minutes ?? 0} mins
							</p>
						</div>
						<Button
							variant="ghost"
							size="icon"
							icon={Trash2}
							aria-label="Delete instruction"
							class="size-6"
							iconClass="size-4"
							onclick={() => {
								rowPendingDelete = row;
								isDeleteDialogOpen = true;
							}}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>

<Dialog bind:open={isAddDialogOpen} title="Select Instructions to Add" hideFooter>
	<div class="flex flex-col gap-4">
		{#if availableInstructions.length === 0}
			<p class="py-4 text-center text-sm text-muted-foreground">
				All instructions are already attached to this ticket.
			</p>
		{:else}
			<div class="flex max-h-72 flex-col gap-1 overflow-y-auto">
				{#each availableInstructions as instruction (instruction.id)}
					<label
						class="flex cursor-pointer items-start gap-2 rounded p-2 text-sm hover:bg-foreground/5"
					>
						<Checkbox
							checked={selectedIds.includes(instruction.id)}
							onCheckedChange={() => toggleSelection(instruction.id)}
						/>
						<span>{instruction.instruction_text}</span>
					</label>
				{/each}
			</div>
		{/if}
		<div class="flex justify-end gap-2">
			<Button
				variant="outline"
				label="Cancel"
				disabled={isAdding}
				onclick={() => (isAddDialogOpen = false)}
			/>
			<Button
				label={`Add (${selectedIds.length})`}
				loading={isAdding}
				disabled={availableInstructions.length === 0}
				onclick={() => void confirmAdd()}
			/>
		</div>
	</div>
</Dialog>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete instruction?"
	description="This removes the instruction from the ticket."
	confirmLabel="Delete"
	confirmVariant="danger"
	onConfirm={() => void confirmDelete()}
	onCancel={() => (rowPendingDelete = null)}
/>
