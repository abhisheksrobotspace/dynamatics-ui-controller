<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import {
		Alert,
		Button,
		Checkbox,
		Combobox,
		Dialog,
		Input,
		Label,
		Skeleton,
		Textarea
	} from '@ifactory/ui-v2';
	import { TICKET_PRIORITIES } from '../lib/constants.js';
	import {
		createTicket,
		getTicket,
		listTicketInstructions,
		addTicketInstructions,
		updateTicket
	} from '../lib/tickets.api.js';
	import { listAlerts, reasonsOf, topLevelAlerts } from '../lib/alerts.api.js';
	import { listInstructions } from '../lib/instructions.api.js';
	import { formatUserName, listAssets, listUsers } from '../lib/masters.api.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import {
		MAINTENANCE_DIALOG_BODY_SCROLL_CLASS,
		MAINTENANCE_DIALOG_CLASS_LG,
		MAINTENANCE_DIALOG_FOOTER_CLASS
	} from '../lib/dialog-layout.js';
	import { focusFormError } from '../lib/focus-form-error.js';
	import { pushSuccessToast } from '../lib/toast.js';
	import type {
		AlertMaster,
		AssetRef,
		Instruction,
		TicketPriority,
		UserRef
	} from '../lib/types.js';

	type Props = {
		open?: boolean;
		ticketId?: number | null;
		onSaved?: () => void;
		onClose?: () => void;
	};

	let { open = $bindable(false), ticketId = null, onSaved, onClose }: Props = $props();

	const isEdit = $derived(ticketId != null);

	let assets = $state.raw<AssetRef[]>([]);
	let users = $state.raw<UserRef[]>([]);
	let alerts = $state.raw<AlertMaster[]>([]);
	let instructions = $state.raw<Instruction[]>([]);

	let dataReady = $state(false);
	let loadError = $state<string | null>(null);
	let formError = $state('');
	let formErrorAnchor = $state<HTMLElement | null>(null);
	let isSaving = $state(false);

	let assetId = $state('');
	let alertId = $state('');
	let reasonId = $state('');
	let description = $state('');
	let priority = $state<TicketPriority | ''>('');
	let assignedTo = $state('');
	let attendedBy = $state('');
	let selectedInstructionIds = $state<number[]>([]);

	let errors = $state({ assetId: false, alertId: false, reasonId: false });

	// Instructions picker dialog
	let isPickerOpen = $state(false);
	let pickerSelection = $state<number[]>([]);

	const assetItems = $derived(
		assets.map((asset) => ({ value: String(asset.id), label: asset.display_id }))
	);
	const alertItems = $derived(
		topLevelAlerts(alerts).map((alert) => ({ value: String(alert.id), label: alert.name }))
	);
	const availableReasons = $derived(reasonsOf(alerts, alertId ? Number(alertId) : null));
	const reasonItems = $derived(
		availableReasons.map((reason) => ({ value: String(reason.id), label: reason.name }))
	);
	const userItems = $derived(
		users.map((user) => ({ value: String(user.id), label: formatUserName(user) }))
	);
	const priorityItems = $derived(
		TICKET_PRIORITIES.map((option) => ({ value: option, label: option }))
	);

	/** Sub-category derives from the chosen reason (reason.parent_id). */
	const derivedSubCategory = $derived.by(() => {
		if (!reasonId) return null;
		const reason = availableReasons.find((row) => String(row.id) === reasonId);
		if (!reason?.parent_id) return null;
		return alerts.find((row) => row.id === reason.parent_id) ?? null;
	});

	const pickableInstructions = $derived(
		instructions.filter((instruction) => !selectedInstructionIds.includes(instruction.id))
	);

	function resetForm() {
		assets = [];
		users = [];
		alerts = [];
		instructions = [];
		dataReady = false;
		loadError = null;
		formError = '';
		isSaving = false;
		assetId = '';
		alertId = '';
		reasonId = '';
		description = '';
		priority = '';
		assignedTo = '';
		attendedBy = '';
		selectedInstructionIds = [];
		errors = { assetId: false, alertId: false, reasonId: false };
		isPickerOpen = false;
		pickerSelection = [];
	}

	function handleAlertChange(value: string | string[]) {
		alertId = String(value);
		reasonId = '';
		errors.alertId = false;
		errors.reasonId = false;
		formError = '';
	}

	function togglePickerInstruction(id: number) {
		pickerSelection = pickerSelection.includes(id)
			? pickerSelection.filter((value) => value !== id)
			: [...pickerSelection, id];
	}

	function confirmPicker() {
		const merged = new Set([...selectedInstructionIds, ...pickerSelection]);
		selectedInstructionIds = [...merged];
		pickerSelection = [];
	}

	function removeInstruction(id: number) {
		selectedInstructionIds = selectedInstructionIds.filter((value) => value !== id);
	}

	function handleCancel() {
		if (isSaving) return;
		open = false;
		cancelLoad();
		resetForm();
		onClose?.();
	}

	function handleOpenChange(next: boolean) {
		if (next) return;
		if (isSaving) {
			open = true;
			return;
		}
		cancelLoad();
		resetForm();
		onClose?.();
	}

	async function handleSave() {
		errors.assetId = !assetId;
		errors.alertId = !alertId;
		errors.reasonId = availableReasons.length > 0 && !reasonId;
		if (errors.assetId || errors.alertId || errors.reasonId) {
			formError = 'Please fill in all required fields.';
			void focusFormError(formErrorAnchor);
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const asset = assets.find((row) => String(row.id) === assetId);
			const common = {
				mid: Number(assetId),
				alert_id: Number(alertId),
				sub_alert_id: reasonId ? Number(reasonId) : null,
				description: description.trim() || null,
				priority: priority || null,
				assigned_to: assignedTo ? Number(assignedTo) : null
			};

			if (isEdit && ticketId != null) {
				const existing = await getTicket(ticketId);
				await updateTicket(ticketId, {
					...common,
					metadata: { ...existing?.metadata, attendedBy: attendedBy.trim() }
				});
				await addTicketInstructions(ticketId, selectedInstructionIds);
				pushSuccessToast({ title: 'Ticket updated.' });
			} else {
				await createTicket({
					...common,
					factory_id: asset?.factory_id ?? null,
					attendedBy: attendedBy.trim(),
					instruction_ids: selectedInstructionIds
				});
				pushSuccessToast({ title: 'Ticket created.' });
			}
			isSaving = false;
			open = false;
			cancelLoad();
			resetForm();
			onSaved?.();
		} catch (error) {
			formError = formatErrorMessage(error);
			void focusFormError(formErrorAnchor);
		} finally {
			isSaving = false;
		}
	}

	let loadController: AbortController | null = null;

	function cancelLoad() {
		loadController?.abort();
		loadController = null;
	}

	async function loadForm(editId: number | null) {
		cancelLoad();
		const controller = new AbortController();
		loadController = controller;

		dataReady = false;
		loadError = null;
		formError = '';
		assetId = '';
		alertId = '';
		reasonId = '';
		description = '';
		priority = '';
		assignedTo = '';
		attendedBy = '';
		selectedInstructionIds = [];
		errors = { assetId: false, alertId: false, reasonId: false };
		isPickerOpen = false;
		pickerSelection = [];

		try {
			[assets, users, alerts, instructions] = await Promise.all([
				listAssets(controller.signal),
				listUsers(controller.signal),
				listAlerts(controller.signal),
				listInstructions(controller.signal)
			]);

			if (editId != null) {
				const [ticket, ticketInstructions] = await Promise.all([
					getTicket(editId, controller.signal),
					listTicketInstructions(editId, controller.signal)
				]);
				if (!ticket) {
					loadError = 'Ticket not found.';
					return;
				}
				assetId = ticket.mid != null ? String(ticket.mid) : '';
				alertId = ticket.alert_id != null ? String(ticket.alert_id) : '';
				reasonId = ticket.sub_alert_id != null ? String(ticket.sub_alert_id) : '';
				description = ticket.description ?? '';
				priority = ticket.priority ?? '';
				assignedTo = ticket.assigned_to != null ? String(ticket.assigned_to) : '';
				attendedBy = ticket.metadata.attendedBy ?? '';
				selectedInstructionIds = ticketInstructions.map((row) => row.instruction_id);
			}
		} catch (error) {
			if (isAbortError(error)) return;
			loadError = formatErrorMessage(error);
		} finally {
			if (!controller.signal.aborted) dataReady = true;
		}
	}

	$effect(() => {
		if (!open) return;
		void loadForm(ticketId);
		return () => cancelLoad();
	});
</script>

<!-- Custom footer: default Dialog footer auto-closes on confirm, which would
     dismiss the form when validation fails. -->
<Dialog
	bind:open
	title={isEdit ? 'Edit Ticket' : 'Add Ticket'}
	size="lg"
	hideFooter={true}
	class={MAINTENANCE_DIALOG_CLASS_LG}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
	closeOnBackdrop={!isSaving}
	showCloseButton={!isSaving}
	onOpenChange={handleOpenChange}
>
	{#if loadError}
		<div class={MAINTENANCE_DIALOG_BODY_SCROLL_CLASS}>
			<Alert variant="error" title="Could not load ticket" description={loadError} />
		</div>
		<div class={MAINTENANCE_DIALOG_FOOTER_CLASS}>
			<Button class="w-full sm:w-auto" variant="outline" label="Cancel" onclick={handleCancel} />
		</div>
	{:else if !dataReady}
		<div class={MAINTENANCE_DIALOG_BODY_SCROLL_CLASS} aria-busy="true" role="status">
			<span class="sr-only">Loading form</span>
			<div class="space-y-4">
				{#each [0, 1, 2, 3, 4] as index (index)}
					<Skeleton class="h-10 w-full" />
				{/each}
			</div>
		</div>
		<div class={MAINTENANCE_DIALOG_FOOTER_CLASS}>
			<Button
				class="w-full sm:w-auto"
				variant="outline"
				label="Cancel"
				onclick={handleCancel}
				disabled={isSaving}
			/>
			<Button class="w-full sm:w-auto" label="Save" disabled />
		</div>
	{:else}
		<div class={MAINTENANCE_DIALOG_BODY_SCROLL_CLASS}>
			<div class="space-y-4">
				<div bind:this={formErrorAnchor}>
					{#if formError}
						<Alert
							variant="error"
							title={isEdit ? 'Could not update ticket' : 'Could not create ticket'}
							description={formError}
						/>
					{/if}
				</div>
				<div class="space-y-2">
					<Label for="add-ticket-asset" text="Asset" required />
					<Combobox
						id="add-ticket-asset"
						items={assetItems}
						bind:value={assetId}
						placeholder="Select Asset"
						onValueChange={() => {
							errors.assetId = false;
							formError = '';
						}}
						triggerClass={errors.assetId ? 'border-status-error' : ''}
					/>
				</div>

				<div class="space-y-2">
					<Label for="add-ticket-alert" text="Alert" required />
					<Combobox
						id="add-ticket-alert"
						items={alertItems}
						value={alertId}
						placeholder="Select Alert"
						onValueChange={handleAlertChange}
						triggerClass={errors.alertId ? 'border-status-error' : ''}
					/>
				</div>

				{#if availableReasons.length > 0}
					<div class="space-y-2">
						<Label for="add-ticket-reason" text="Reason" required />
						<Combobox
							id="add-ticket-reason"
							items={reasonItems}
							bind:value={reasonId}
							placeholder="Select Reason"
							onValueChange={() => (errors.reasonId = false)}
							triggerClass={errors.reasonId ? 'border-status-error' : ''}
						/>
					</div>
				{/if}

				{#if derivedSubCategory}
					<div class="space-y-2">
						<Label for="add-ticket-sub-category" text="Sub Category" />
						<Input id="add-ticket-sub-category" value={derivedSubCategory.name} disabled />
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="add-ticket-description" text="Description" />
					<Textarea
						id="add-ticket-description"
						bind:value={description}
						placeholder="Description"
						class="resize-none"
					/>
				</div>

				<div class="space-y-2">
					<Label for="add-ticket-priority" text="Priority" />
					<Combobox
						id="add-ticket-priority"
						items={priorityItems}
						bind:value={priority}
						placeholder="Select priority"
					/>
				</div>

				<div class="space-y-2">
					<Label for="add-ticket-assigned-to" text="Assigned To" />
					<Combobox
						id="add-ticket-assigned-to"
						items={userItems}
						bind:value={assignedTo}
						placeholder="Select User"
					/>
				</div>

				<div class="space-y-2">
					<Label for="add-ticket-attended-by" text="Attended By" />
					<Input
						id="add-ticket-attended-by"
						type="text"
						bind:value={attendedBy}
						placeholder="Enter attended by"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label text="Instructions" />
						<Button
							size="sm"
							label="Add"
							onclick={() => {
								pickerSelection = [];
								isPickerOpen = true;
							}}
						/>
					</div>
					<div class="rounded-md border border-border bg-background">
						{#if selectedInstructionIds.length === 0}
							<p class="p-4 text-center text-sm text-muted-foreground">No instructions selected.</p>
						{:else}
							<ul class="divide-y divide-border">
								{#each selectedInstructionIds as id (id)}
									{@const instruction = instructions.find((row) => row.id === id)}
									{#if instruction}
										<li class="flex items-start justify-between gap-3 p-3">
											<div class="flex flex-col">
												<p class="text-sm font-medium text-foreground">
													{instruction.instruction_text}
												</p>
												<p class="text-xs text-muted-foreground">
													Duration: {instruction.estimated_duration_minutes} mins
												</p>
											</div>
											<Button
												variant="ghost"
												size="icon"
												icon={Trash2}
												aria-label="Remove instruction"
												onclick={() => removeInstruction(id)}
											/>
										</li>
									{/if}
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div class={MAINTENANCE_DIALOG_FOOTER_CLASS}>
			<Button
				class="w-full sm:w-auto"
				variant="outline"
				label="Cancel"
				onclick={handleCancel}
				disabled={isSaving}
			/>
			<Button
				class="min-w-24 w-full sm:w-auto"
				variant="primary"
				label={isSaving ? 'Saving...' : 'Save'}
				onclick={() => void handleSave()}
				loading={isSaving}
			/>
		</div>
	{/if}
</Dialog>

<Dialog
	bind:open={isPickerOpen}
	title="Select Instructions"
	confirmLabel={`Add (${pickerSelection.length})`}
	onConfirm={confirmPicker}
>
	<div class="flex max-h-[300px] flex-col gap-1 overflow-y-auto">
		{#if pickableInstructions.length === 0}
			<p class="p-2 text-sm text-muted-foreground">All instructions are already added.</p>
		{:else}
			{#each pickableInstructions as instruction (instruction.id)}
				<label class="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-foreground/5">
					<Checkbox
						checked={pickerSelection.includes(instruction.id)}
						onCheckedChange={() => togglePickerInstruction(instruction.id)}
					/>
					<span class="text-sm text-foreground">{instruction.instruction_text}</span>
				</label>
			{/each}
		{/if}
	</div>
</Dialog>
