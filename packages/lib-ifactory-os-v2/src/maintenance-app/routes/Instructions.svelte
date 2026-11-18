<script lang="ts">
	import { onMount } from 'svelte';
	import { ListChecks, Pencil, Trash2, Plus } from '@lucide/svelte';
	import { Alert, ConfirmationDialog, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { deleteInstruction, listInstructions } from '../lib/instructions.api.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { pushErrorToast, pushSuccessToast } from '../lib/toast.js';
	import type { Instruction } from '../lib/types.js';
	import AddInstructionDialog from '../components/AddInstructionDialog.svelte';

	let instructions = $state.raw<Instruction[]>([]);
	let dataReady = $state(false);
	let errorMessage = $state<string | null>(null);
	let isInstructionDialogOpen = $state(false);
	let instructionDialogId = $state<number | null>(null);

	type InstructionRow = {
		id: number;
		s_no: number;
		instruction_text: string;
		estimated_duration_minutes: number;
	};

	const rows = $derived<InstructionRow[]>(
		instructions.map((instruction, index) => ({
			id: instruction.id,
			s_no: index + 1,
			instruction_text: instruction.instruction_text || '-',
			estimated_duration_minutes: instruction.estimated_duration_minutes || 0
		}))
	);

	const columns: DataTableColumn<InstructionRow>[] = [
		{
			type: 'serial',
			key: 's_no',
			header: 'S.No',
			dataType: 'number',
			value: (row) => String(row.s_no)
		},
		{
			key: 'instruction_text',
			header: 'Instruction',
			sortable: true,
			value: (row) => row.instruction_text
		},
		{
			key: 'estimated_duration_minutes',
			header: 'Duration (Mins)',
			dataType: 'number',
			sortable: true,
			value: (row) => String(row.estimated_duration_minutes)
		},
		{
			type: 'actions',
			key: 'actions',
			header: '',
			actions: (row) => [
				{
					type: 'button',
					icon: Pencil,
					variant: 'ghost',
					ariaLabel: 'Edit instruction',
					onClick: () => {
						instructionDialogId = row.id;
						isInstructionDialogOpen = true;
					}
				},
				{
					type: 'button',
					icon: Trash2,
					variant: 'ghost',
					ariaLabel: 'Delete instruction',
					onClick: () => {
						pendingDeleteId = row.id;
						isDeleteDialogOpen = true;
					}
				}
			]
		}
	];

	async function loadPageData(signal?: AbortSignal) {
		instructions = await listInstructions(signal);
	}

	// --- Delete confirmation ---
	let pendingDeleteId = $state<number | null>(null);
	let isDeleteDialogOpen = $state(false);

	async function confirmDelete() {
		const id = pendingDeleteId;
		pendingDeleteId = null;
		if (id == null) return;
		try {
			await deleteInstruction(id);
			pushSuccessToast({ title: 'Instruction deleted.' });
			await loadPageData();
		} catch (error) {
			pushErrorToast({ title: 'Delete failed', description: formatErrorMessage(error) });
		}
	}

	function handleAdd() {
		instructionDialogId = null;
		isInstructionDialogOpen = true;
	}

	function handleInstructionSaved() {
		void loadPageData();
	}

	onMount(() => {
		const controller = new AbortController();
		loadPageData(controller.signal)
			.then(() => (dataReady = true))
			.catch((error) => {
				if (isAbortError(error)) return;
				errorMessage = formatErrorMessage(error);
				dataReady = true;
			});
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3">
	<div class="flex items-end justify-between gap-3">
		<!-- <h1 class="font-heading text-2xl font-bold text-foreground">Instructions</h1> -->
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load instructions" description={errorMessage} />
	{/if}

	<DataTable
		{columns}
		{rows}
		loading={!dataReady}
		rowKey={(row) => String(row.id)}
		search={{ enabled: true, placeholder: 'Search instructions' }}
		emptyState={{
			icon: ListChecks,
			title: 'No instructions found',
			description: 'Maintenance instructions will appear here'
		}}
		toolbarButton={[
			{
				enabled: true,
				label: 'Add Instruction',
				icon: Plus,
				onClick: handleAdd
			}
		]}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>

<AddInstructionDialog
	bind:open={isInstructionDialogOpen}
	instructionId={instructionDialogId}
	onSaved={handleInstructionSaved}
/>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete instruction?"
	description="Are you sure you want to delete this instruction?"
	confirmLabel="Delete"
	confirmVariant="danger"
	onConfirm={() => void confirmDelete()}
	onCancel={() => (pendingDeleteId = null)}
/>
