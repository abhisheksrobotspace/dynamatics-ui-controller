<script lang="ts">
	import { Pencil } from '@lucide/svelte';
	import { Button, Combobox, Dialog, Input, Label } from '@ifactory/ui-v2';
	import {
		calculateDuration,
		canEditClosedTicketIssue,
		formatDateTime,
		getCaseEndAt,
		getWorkEndAt,
		normalizeAnalysis,
		CURRENT_USER_ID,
		TICKET_PRIORITIES,
		TICKET_STATUS
	} from '../../lib/constants.js';
	import { reasonsOf, resolveTicketTaxonomy } from '../../lib/alerts.api.js';
	import { submitReasonCorrection, updateTicket } from '../../lib/tickets.api.js';
	import { formatUserName } from '../../lib/masters.api.js';
	import { formatErrorMessage } from '../../lib/errors.js';
	import { pushErrorToast, pushSuccessToast } from '../../lib/toast.js';
	import type {
		AlertMaster,
		MaintenanceTicket,
		Shift,
		TicketPriority,
		UserRef
	} from '../../lib/types.js';

	type Props = {
		ticket: MaintenanceTicket;
		alerts: AlertMaster[];
		users: UserRef[];
		shifts: Shift[];
		onChanged: () => void;
	};

	let { ticket, alerts, users, shifts, onChanged }: Props = $props();

	const isClosed = $derived(ticket.status === TICKET_STATUS.CLOSED);
	const taxonomy = $derived(resolveTicketTaxonomy(alerts, ticket.sub_alert_id));
	const issueName = $derived(
		ticket.alert_id != null ? (alerts.find((row) => row.id === ticket.alert_id)?.name ?? '-') : '-'
	);
	const assignedToName = $derived(
		ticket.assigned_to != null
			? formatUserName(users.find((row) => row.id === ticket.assigned_to))
			: '-'
	);
	const availableSubReasons = $derived(reasonsOf(alerts, ticket.alert_id));
	/** Top-level HMI reasons offered by the closed-ticket issue correction. */
	const mainReasons = $derived(
		alerts
			.filter((row) => row.available_on_hmi && !row.parent_id)
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const canEditIssue = $derived(canEditClosedTicketIssue(ticket, shifts) && mainReasons.length > 0);
	const canLogTime = $derived(isClosed && !ticket.started_at && getWorkEndAt(ticket) != null);

	// --- Assign user dialog ---
	let isUserDialogOpen = $state(false);
	let selectedUserId = $state('');
	let isUpdating = $state(false);

	const userItems = $derived(
		users.map((user) => ({ value: String(user.id), label: formatUserName(user) }))
	);

	// --- Priority dialog (native radios, per migration decision) ---
	let isPriorityDialogOpen = $state(false);
	let selectedPriority = $state<TicketPriority | ''>('');

	// --- Sub-reason dialog ---
	let isSubReasonDialogOpen = $state(false);
	let selectedSubReasonId = $state('');

	const subReasonItems = $derived(
		availableSubReasons.map((reason) => ({ value: String(reason.id), label: reason.name }))
	);

	// --- Issue correction dialog ---
	let isIssueDialogOpen = $state(false);
	let selectedIssueId = $state('');
	let correctionNote = $state('');

	const issueItems = $derived(
		mainReasons.map((reason) => ({ value: String(reason.id), label: reason.name }))
	);

	// --- Attended-by inline edit ---
	let isEditingContractor = $state(false);
	let contractorDraft = $state('');

	// --- Log time dialog ---
	let isLogTimeOpen = $state(false);
	let logStartDate = $state('');
	let logStartTime = $state('');
	let logEndDate = $state('');
	let logEndTime = $state('');

	async function patchTicket(patch: Parameters<typeof updateTicket>[1], successTitle: string) {
		isUpdating = true;
		try {
			await updateTicket(ticket.id, patch);
			pushSuccessToast({ title: successTitle });
			onChanged();
			return true;
		} catch (error) {
			pushErrorToast({ title: 'Update failed', description: formatErrorMessage(error) });
			return false;
		} finally {
			isUpdating = false;
		}
	}

	async function confirmUser() {
		if (!selectedUserId) return;
		if (await patchTicket({ assigned_to: Number(selectedUserId) }, 'Assignee updated.')) {
			isUserDialogOpen = false;
		}
	}

	async function confirmPriority() {
		if (!selectedPriority) return;
		if (await patchTicket({ priority: selectedPriority }, 'Priority updated.')) {
			isPriorityDialogOpen = false;
		}
	}

	async function confirmSubReason() {
		if (!selectedSubReasonId) return;
		if (await patchTicket({ sub_alert_id: Number(selectedSubReasonId) }, 'Sub reason updated.')) {
			isSubReasonDialogOpen = false;
		}
	}

	async function confirmIssue() {
		if (!selectedIssueId) return;
		if (Number(selectedIssueId) === ticket.alert_id) {
			isIssueDialogOpen = false;
			return;
		}
		isUpdating = true;
		try {
			await submitReasonCorrection(ticket.id, {
				newAlertId: Number(selectedIssueId),
				newSubAlertId: null,
				note: correctionNote.trim(),
				changedBy: CURRENT_USER_ID
			});
			pushSuccessToast({ title: 'Issue corrected.' });
			isIssueDialogOpen = false;
			correctionNote = '';
			onChanged();
		} catch (error) {
			pushErrorToast({ title: 'Update failed', description: formatErrorMessage(error) });
		} finally {
			isUpdating = false;
		}
	}

	async function saveContractor() {
		const value = contractorDraft.trim();
		if (value === (ticket.metadata.attendedBy ?? '')) {
			isEditingContractor = false;
			return;
		}
		const metadata = {
			...ticket.metadata,
			analysis: normalizeAnalysis(ticket.metadata),
			attendedBy: value
		};
		if (await patchTicket({ metadata }, 'Contractor saved.')) {
			isEditingContractor = false;
		}
	}

	function openLogTime() {
		const endRaw = getWorkEndAt(ticket);
		const end = endRaw ? new Date(endRaw) : new Date();
		const pad = (value: number) => String(value).padStart(2, '0');
		const dateKey = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
		const timeKey = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
		logStartDate = dateKey;
		logStartTime = timeKey;
		logEndDate = dateKey;
		logEndTime = timeKey;
		isLogTimeOpen = true;
	}

	async function saveLoggedTime() {
		if (!logStartDate || !logStartTime || !logEndDate || !logEndTime) {
			pushErrorToast({ title: 'Enter start and end date/time.' });
			return;
		}
		const start = new Date(`${logStartDate}T${logStartTime}`);
		const end = new Date(`${logEndDate}T${logEndTime}`);
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
			pushErrorToast({ title: 'Start time must be before end time.' });
			return;
		}
		if (
			await patchTicket(
				{ started_at: start.toISOString(), resolved_at: end.toISOString() },
				'Work time logged.'
			)
		) {
			isLogTimeOpen = false;
		}
	}
</script>

<section class="overflow-hidden border border-border bg-surface text-foreground">
	<div class="px-4 pt-4">
		<h3 class="font-heading text-base font-semibold">Ticket Details</h3>
	</div>
	<div class="grid grid-cols-1 gap-6 px-4 pt-3 pb-4 text-sm sm:grid-cols-2">
		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Issue</p>
			<div class="flex items-center justify-between gap-2">
				<p class="font-semibold text-foreground">{issueName}</p>
				{#if canEditIssue}
					<Button
						variant="ghost"
						size="icon"
						icon={Pencil}
						aria-label="Edit issue"
						class="size-6"
						iconClass="size-3.5"
						onclick={() => {
							selectedIssueId = ticket.alert_id != null ? String(ticket.alert_id) : '';
							correctionNote = '';
							isIssueDialogOpen = true;
						}}
					/>
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Sub Category</p>
			<p class="font-semibold text-foreground">{taxonomy.subCategory?.name ?? '-'}</p>
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Sub Reason</p>
			{#if taxonomy.reason == null}
				{#if availableSubReasons.length > 0}
					<Button
						size="sm"
						label="Add"
						class="w-min"
						onclick={() => {
							selectedSubReasonId = '';
							isSubReasonDialogOpen = true;
						}}
					/>
				{:else}
					<p class="font-semibold text-foreground">-</p>
				{/if}
			{:else}
				<div class="flex items-center justify-between gap-2">
					<p class="font-semibold text-foreground">{taxonomy.reason.name}</p>
					{#if canEditIssue}
						<Button
							variant="ghost"
							size="icon"
							icon={Pencil}
							aria-label="Edit sub reason"
							class="size-6"
							iconClass="size-3.5"
							onclick={() => {
								selectedSubReasonId = String(taxonomy.reason?.id ?? '');
								isSubReasonDialogOpen = true;
							}}
						/>
					{/if}
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Priority</p>
			{#if isClosed || ticket.priority}
				<p class="font-semibold text-foreground">{ticket.priority ?? '-'}</p>
			{:else}
				<Button
					size="sm"
					label="Add Priority"
					class="w-min"
					onclick={() => {
						selectedPriority = '';
						isPriorityDialogOpen = true;
					}}
				/>
			{/if}
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Created</p>
			<p class="font-semibold text-foreground">{formatDateTime(ticket.created_at)}</p>
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Started</p>
			<p class="font-semibold text-foreground">{formatDateTime(ticket.started_at)}</p>
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Closed</p>
			<p class="font-semibold text-foreground">{formatDateTime(ticket.closed_at)}</p>
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Case Duration</p>
			<p class="font-semibold text-foreground">
				{calculateDuration(ticket.created_at, getCaseEndAt(ticket))}
			</p>
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Work Duration</p>
			<div class="flex items-center justify-between gap-2">
				<p class="font-semibold text-foreground">
					{calculateDuration(ticket.started_at, getWorkEndAt(ticket))}
				</p>
				{#if canLogTime}
					<Button size="sm" label="Log Time" class="w-min" onclick={openLogTime} />
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Assigned To</p>
			{#if ticket.assigned_to == null}
				<Button
					size="sm"
					label="Add"
					class="w-min"
					onclick={() => {
						selectedUserId = '';
						isUserDialogOpen = true;
					}}
				/>
			{:else}
				<div class="flex items-center justify-between gap-2">
					<p class="font-semibold text-foreground">{assignedToName}</p>
					<Button
						variant="ghost"
						size="icon"
						icon={Pencil}
						aria-label="Edit assignee"
						class="size-6"
						iconClass="size-3.5"
						onclick={() => {
							selectedUserId = String(ticket.assigned_to);
							isUserDialogOpen = true;
						}}
					/>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-1">
			<p class="text-muted-foreground">Attended By</p>
			{#if !ticket.metadata.attendedBy || isEditingContractor}
				<div class="flex items-center gap-2">
					<Input
						size="sm"
						bind:value={contractorDraft}
						placeholder="Enter contractor"
						disabled={isUpdating}
						onkeydown={(event: KeyboardEvent) => {
							if (event.key === 'Enter') void saveContractor();
						}}
					/>
					{#if isEditingContractor}
						<Button
							size="sm"
							variant="outline"
							label="Cancel"
							disabled={isUpdating}
							onclick={() => {
								contractorDraft = ticket.metadata.attendedBy ?? '';
								isEditingContractor = false;
							}}
						/>
					{/if}
					<Button
						size="sm"
						label="Save"
						loading={isUpdating}
						disabled={!contractorDraft.trim()}
						onclick={saveContractor}
					/>
				</div>
			{:else}
				<div class="flex items-center justify-between gap-2">
					<p class="font-semibold text-foreground">{ticket.metadata.attendedBy}</p>
					<Button
						variant="ghost"
						size="icon"
						icon={Pencil}
						aria-label="Edit contractor"
						class="size-6"
						iconClass="size-3.5"
						onclick={() => {
							contractorDraft = ticket.metadata.attendedBy ?? '';
							isEditingContractor = true;
						}}
					/>
				</div>
			{/if}
		</div>
	</div>
</section>

<Dialog
	bind:open={isUserDialogOpen}
	title="Select User"
	confirmLabel="Confirm"
	onConfirm={() => void confirmUser()}
>
	<Combobox items={userItems} bind:value={selectedUserId} placeholder="Select user" />
</Dialog>

<Dialog
	bind:open={isPriorityDialogOpen}
	title="Select Priority"
	confirmLabel="Confirm"
	onConfirm={() => void confirmPriority()}
>
	<div class="flex flex-col gap-2">
		{#each TICKET_PRIORITIES as option (option)}
			<label
				class="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-foreground/5"
			>
				<input
					type="radio"
					name="details-priority"
					value={option}
					bind:group={selectedPriority}
					class="size-4 accent-primary"
				/>
				{option}
			</label>
		{/each}
	</div>
</Dialog>

<Dialog
	bind:open={isSubReasonDialogOpen}
	title="Select Sub Reason"
	confirmLabel="Confirm"
	onConfirm={() => void confirmSubReason()}
>
	<Combobox
		items={subReasonItems}
		bind:value={selectedSubReasonId}
		placeholder="Select sub reason"
	/>
</Dialog>

<Dialog
	bind:open={isIssueDialogOpen}
	title="Select Issue"
	confirmLabel="Confirm"
	onConfirm={() => void confirmIssue()}
>
	<div class="flex flex-col gap-3">
		<Combobox items={issueItems} bind:value={selectedIssueId} placeholder="Select issue" />
		<div class="flex flex-col gap-2">
			<Label for="issue-correction-note">Note</Label>
			<Input
				id="issue-correction-note"
				type="text"
				bind:value={correctionNote}
				maxlength={2000}
				placeholder="Why is the issue being corrected?"
			/>
		</div>
	</div>
</Dialog>

<!-- Custom footer: the default Dialog footer auto-closes on confirm, which
     would drop the user's input when validation fails. -->
<Dialog bind:open={isLogTimeOpen} title="Log Work Time" hideFooter>
	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-2">
				<Label for="log-start-date">Start Date <span class="text-status-error">*</span></Label>
				<Input id="log-start-date" type="date" bind:value={logStartDate} />
			</div>
			<div class="flex flex-col gap-2">
				<Label for="log-start-time">Start Time <span class="text-status-error">*</span></Label>
				<Input id="log-start-time" type="time" step="60" bind:value={logStartTime} />
			</div>
			<div class="flex flex-col gap-2">
				<Label for="log-end-date">End Date <span class="text-status-error">*</span></Label>
				<Input id="log-end-date" type="date" bind:value={logEndDate} />
			</div>
			<div class="flex flex-col gap-2">
				<Label for="log-end-time">End Time <span class="text-status-error">*</span></Label>
				<Input id="log-end-time" type="time" step="60" bind:value={logEndTime} />
			</div>
		</div>
		<div class="flex justify-end gap-2">
			<Button
				variant="outline"
				label="Cancel"
				disabled={isUpdating}
				onclick={() => (isLogTimeOpen = false)}
			/>
			<Button label="Save" loading={isUpdating} onclick={() => void saveLoggedTime()} />
		</div>
	</div>
</Dialog>
