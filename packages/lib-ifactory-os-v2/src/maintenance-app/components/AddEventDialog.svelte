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
		buildRruleString,
		createEvent,
		getEvent,
		parseRruleToRecurrence,
		requestEventChangeApproval,
		requestEventDeleteApproval,
		updateEvent,
		type CustomRepeatUnit,
		type EventFrequency,
		type RecurrenceInput
	} from '../lib/events.api.js';
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
		AssetRef,
		Instruction,
		ScheduledMaintenanceEvent,
		TicketPriority,
		UserRef
	} from '../lib/types.js';

	type Props = {
		open?: boolean;
		eventId?: number | null;
		onSaved?: () => void;
		onClose?: () => void;
	};

	let { open = $bindable(false), eventId = null, onSaved, onClose }: Props = $props();

	const isEdit = $derived(eventId != null);

	const FREQUENCY_OPTIONS: { value: EventFrequency; label: string }[] = [
		{ value: 'once', label: 'Once' },
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'fortnightly', label: 'Fortnightly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'quarterly', label: 'Quarterly' },
		{ value: 'half-yearly', label: 'Half-yearly' },
		{ value: 'yearly', label: 'Yearly' },
		{ value: 'custom', label: 'Custom' }
	];

	const CUSTOM_UNIT_OPTIONS: { value: CustomRepeatUnit; label: string }[] = [
		{ value: 'day', label: 'Day(s)' },
		{ value: 'week', label: 'Week(s)' },
		{ value: 'month', label: 'Month(s)' },
		{ value: 'year', label: 'Year(s)' }
	];

	const WEEKDAY_OPTIONS = [
		{ day: 1, label: 'Mon' },
		{ day: 2, label: 'Tue' },
		{ day: 3, label: 'Wed' },
		{ day: 4, label: 'Thu' },
		{ day: 5, label: 'Fri' },
		{ day: 6, label: 'Sat' },
		{ day: 0, label: 'Sun' }
	];

	let assets = $state.raw<AssetRef[]>([]);
	let users = $state.raw<UserRef[]>([]);
	let instructions = $state.raw<Instruction[]>([]);

	let dataReady = $state(false);
	let loadError = $state<string | null>(null);
	let formError = $state('');
	let approvalFormError = $state('');
	let deleteFormError = $state('');
	let formErrorAnchor = $state<HTMLElement | null>(null);
	let approvalFormErrorAnchor = $state<HTMLElement | null>(null);
	let deleteFormErrorAnchor = $state<HTMLElement | null>(null);
	let isSaving = $state(false);

	let title = $state('');
	let assetId = $state('');
	let description = $state('');
	let priority = $state<TicketPriority | ''>('');
	let startDate = $state('');
	let startTime = $state('08:00');
	let durationMinutes = $state('60');
	let assignedTo = $state('');
	let selectedInstructionIds = $state<number[]>([]);

	let frequency = $state<EventFrequency>('once');
	let customInterval = $state('1');
	let customUnit = $state<CustomRepeatUnit>('week');
	let customWeekdays = $state<number[]>([]);
	let endType = $state<'date' | 'count'>('count');
	let endDate = $state('');
	let endCount = $state('10');

	let errors = $state({ title: false, assetId: false, startDate: false });

	let originalEvent = $state<ScheduledMaintenanceEvent | null>(null);

	let isPickerOpen = $state(false);
	let pickerSelection = $state<number[]>([]);

	let isApprovalOpen = $state(false);
	let approvalComment = $state('');
	let pendingScheduleChanges = $state<Record<string, string>>({});

	let isDeleteOpen = $state(false);
	let deleteScope = $state<'current_only' | 'entire_series'>('current_only');
	let deleteComment = $state('');

	const assetItems = $derived(
		assets.map((asset) => ({ value: String(asset.id), label: asset.display_id }))
	);
	const userItems = $derived(
		users.map((user) => ({ value: String(user.id), label: formatUserName(user) }))
	);
	const frequencyItems = FREQUENCY_OPTIONS.map((option) => ({
		value: option.value,
		label: option.label
	}));
	const customUnitItems = CUSTOM_UNIT_OPTIONS.map((option) => ({
		value: option.value,
		label: option.label
	}));
	const priorityItems = $derived(
		TICKET_PRIORITIES.map((option) => ({ value: option, label: option }))
	);

	const isRecurring = $derived(frequency !== 'once');
	const pickableInstructions = $derived(
		instructions.filter((instruction) => !selectedInstructionIds.includes(instruction.id))
	);

	function resetForm() {
		assets = [];
		users = [];
		instructions = [];
		dataReady = false;
		loadError = null;
		formError = '';
		approvalFormError = '';
		deleteFormError = '';
		isSaving = false;
		title = '';
		assetId = '';
		description = '';
		priority = '';
		startDate = '';
		startTime = '08:00';
		durationMinutes = '60';
		assignedTo = '';
		selectedInstructionIds = [];
		frequency = 'once';
		customInterval = '1';
		customUnit = 'week';
		customWeekdays = [];
		endType = 'count';
		endDate = '';
		endCount = '10';
		errors = { title: false, assetId: false, startDate: false };
		originalEvent = null;
		isPickerOpen = false;
		pickerSelection = [];
		isApprovalOpen = false;
		approvalComment = '';
		pendingScheduleChanges = {};
		isDeleteOpen = false;
		deleteScope = 'current_only';
		deleteComment = '';
	}

	function finishSaved() {
		isSaving = false;
		open = false;
		cancelLoad();
		resetForm();
		onSaved?.();
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

	function toggleWeekday(day: number) {
		customWeekdays = customWeekdays.includes(day)
			? customWeekdays.filter((value) => value !== day)
			: [...customWeekdays, day];
	}

	function currentRecurrence(): RecurrenceInput {
		return {
			frequency,
			customInterval: Number(customInterval) || 1,
			customUnit,
			customWeekdays,
			endType,
			endDate,
			endCount: Number(endCount) || 1
		};
	}

	function applyRecurrence(recurrence: RecurrenceInput) {
		frequency = recurrence.frequency;
		customInterval = String(recurrence.customInterval);
		customUnit = recurrence.customUnit;
		customWeekdays = [...recurrence.customWeekdays];
		endType = recurrence.endType;
		endDate = recurrence.endDate;
		endCount = String(recurrence.endCount);
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

	function validate(): boolean {
		errors.title = !title.trim();
		errors.assetId = !assetId;
		errors.startDate = !startDate;
		if (errors.title || errors.assetId || errors.startDate) {
			formError = 'Please fill in all required fields.';
			void focusFormError(formErrorAnchor);
			return false;
		}
		return true;
	}

	function buildRrule(): string | null {
		return buildRruleString(
			currentRecurrence(),
			new Date(`${startDate}T${startTime || '00:00'}:00`)
		);
	}

	function collectScheduleChanges(): Record<string, string> {
		if (!originalEvent) return {};
		const changes: Record<string, string> = {};
		if (startDate !== originalEvent.start_date) changes.start_date = startDate;
		if (startTime !== originalEvent.start_time) changes.start_time = startTime;
		const duration = Number(durationMinutes) || 0;
		if (duration !== originalEvent.duration_minutes) {
			changes.duration_minutes = String(duration);
		}
		const rrule = buildRrule();
		if ((rrule ?? '') !== (originalEvent.rrule ?? '')) changes.rrule = rrule ?? '';
		return changes;
	}

	async function saveNonScheduleFields(id: number) {
		await updateEvent(id, {
			title: title.trim(),
			mid: Number(assetId),
			description: description.trim() || null,
			priority: priority || null,
			assigned_to: assignedTo ? Number(assignedTo) : null,
			instruction_ids: selectedInstructionIds
		});
	}

	async function handleSave() {
		if (!validate()) return;

		if (isEdit && eventId != null) {
			const scheduleChanges = collectScheduleChanges();
			if (Object.keys(scheduleChanges).length > 0) {
				pendingScheduleChanges = scheduleChanges;
				approvalComment = '';
				approvalFormError = '';
				isApprovalOpen = true;
				return;
			}
			isSaving = true;
			formError = '';
			try {
				await saveNonScheduleFields(eventId);
				pushSuccessToast({ title: 'Event updated.' });
				finishSaved();
			} catch (error) {
				formError = formatErrorMessage(error);
				void focusFormError(formErrorAnchor);
			} finally {
				isSaving = false;
			}
			return;
		}

		isSaving = true;
		formError = '';
		try {
			await createEvent({
				title: title.trim(),
				mid: Number(assetId),
				description: description.trim() || null,
				priority: priority || null,
				start_date: startDate,
				start_time: startTime,
				duration_minutes: Number(durationMinutes) || 0,
				rrule: buildRrule(),
				assigned_to: assignedTo ? Number(assignedTo) : null,
				instruction_ids: selectedInstructionIds
			});
			pushSuccessToast({ title: 'Event created.' });
			finishSaved();
		} catch (error) {
			formError = formatErrorMessage(error);
			void focusFormError(formErrorAnchor);
		} finally {
			isSaving = false;
		}
	}

	async function submitScheduleApproval() {
		if (eventId == null) return;
		isSaving = true;
		approvalFormError = '';
		try {
			await saveNonScheduleFields(eventId);
			await requestEventChangeApproval({
				eventId,
				changes: pendingScheduleChanges,
				comment: approvalComment
			});
			pushSuccessToast({
				title: 'Change request submitted.',
				description: 'Schedule changes apply once approved.'
			});
			finishSaved();
		} catch (error) {
			approvalFormError = formatErrorMessage(error);
			void focusFormError(approvalFormErrorAnchor);
		} finally {
			isSaving = false;
		}
	}

	async function submitDeleteApproval() {
		if (eventId == null) return;
		isSaving = true;
		deleteFormError = '';
		try {
			await requestEventDeleteApproval({
				eventId,
				scope: originalEvent?.rrule ? deleteScope : 'entire_series',
				comment: deleteComment
			});
			pushSuccessToast({
				title: 'Delete request submitted.',
				description: 'The event is removed once approved.'
			});
			finishSaved();
		} catch (error) {
			deleteFormError = formatErrorMessage(error);
			void focusFormError(deleteFormErrorAnchor);
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
		approvalFormError = '';
		deleteFormError = '';
		isSaving = false;
		title = '';
		assetId = '';
		description = '';
		priority = '';
		startDate = '';
		startTime = '08:00';
		durationMinutes = '60';
		assignedTo = '';
		selectedInstructionIds = [];
		frequency = 'once';
		customInterval = '1';
		customUnit = 'week';
		customWeekdays = [];
		endType = 'count';
		endDate = '';
		endCount = '10';
		errors = { title: false, assetId: false, startDate: false };
		originalEvent = null;
		isPickerOpen = false;
		pickerSelection = [];
		isApprovalOpen = false;
		approvalComment = '';
		pendingScheduleChanges = {};
		isDeleteOpen = false;
		deleteScope = 'current_only';
		deleteComment = '';

		try {
			[assets, users, instructions] = await Promise.all([
				listAssets(controller.signal),
				listUsers(controller.signal),
				listInstructions(controller.signal)
			]);

			if (editId != null) {
				const event = await getEvent(editId, controller.signal);
				if (!event) {
					loadError = 'Event not found.';
					return;
				}
				originalEvent = event;
				title = event.title;
				assetId = event.mid != null ? String(event.mid) : '';
				description = event.description ?? '';
				priority = event.priority ?? '';
				startDate = event.start_date;
				startTime = event.start_time;
				durationMinutes = String(event.duration_minutes);
				assignedTo = event.assigned_to != null ? String(event.assigned_to) : '';
				selectedInstructionIds = [...event.instruction_ids];
				applyRecurrence(parseRruleToRecurrence(event.rrule));
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
		void loadForm(eventId);
		return () => cancelLoad();
	});
</script>

<Dialog
	bind:open
	title={isEdit ? 'Edit Event' : 'Add Event'}
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
			<Alert variant="error" title="Could not load event" description={loadError} />
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
							title={isEdit ? 'Could not update event' : 'Could not create event'}
							description={formError}
						/>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="add-event-title" text="Title" required />
					<Input
						id="add-event-title"
						type="text"
						bind:value={title}
						placeholder="Event title"
						oninput={() => {
							errors.title = false;
							formError = '';
						}}
						class={errors.title ? 'border-status-error' : ''}
					/>
				</div>

				<div class="space-y-2">
					<Label for="add-event-asset" text="Asset" required />
					<Combobox
						id="add-event-asset"
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
					<Label for="add-event-description" text="Description" />
					<Textarea id="add-event-description" bind:value={description} placeholder="Description" />
				</div>

				<div class="space-y-2">
					<Label for="add-event-priority" text="Priority" />
					<Combobox
						id="add-event-priority"
						items={priorityItems}
						bind:value={priority}
						placeholder="Select priority"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="add-event-start-date" text="Start date" required />
						<Input
							id="add-event-start-date"
							type="date"
							bind:value={startDate}
							oninput={() => {
								errors.startDate = false;
								formError = '';
							}}
							class={errors.startDate ? 'border-status-error' : ''}
						/>
					</div>
					<div class="space-y-2">
						<Label for="add-event-start-time" text="Start time" />
						<Input id="add-event-start-time" type="time" bind:value={startTime} />
					</div>
				</div>

				<div class="space-y-2">
					<Label for="add-event-duration" text="Duration (minutes)" />
					<Input
						id="add-event-duration"
						type="number"
						min="5"
						step="5"
						bind:value={durationMinutes}
					/>
				</div>

				<div class="space-y-2">
					<Label for="add-event-repeat" text="Repeat" />
					<Combobox
						id="add-event-repeat"
						items={frequencyItems}
						value={frequency}
						onValueChange={(value) => (frequency = String(value) as EventFrequency)}
					/>
				</div>

				{#if frequency === 'custom'}
					<div class="flex flex-col gap-3 rounded-md border border-border bg-background p-3">
						<div class="flex items-center gap-2">
							<span class="text-sm text-foreground">Every</span>
							<Input
								type="number"
								min="1"
								bind:value={customInterval}
								class="w-20"
								aria-label="Repeat interval"
							/>
							<div class="w-32">
								<Combobox
									items={customUnitItems}
									value={customUnit}
									onValueChange={(value) => (customUnit = String(value) as CustomRepeatUnit)}
								/>
							</div>
						</div>
						{#if customUnit === 'week'}
							<div class="flex flex-wrap items-center gap-3">
								{#each WEEKDAY_OPTIONS as option (option.day)}
									<label class="flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
										<Checkbox
											checked={customWeekdays.includes(option.day)}
											onCheckedChange={() => toggleWeekday(option.day)}
										/>
										{option.label}
									</label>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if isRecurring}
					<div class="space-y-2">
						<Label text="Ends" />
						<div class="flex flex-col gap-3">
							<div class="flex items-center gap-3">
								<label class="flex cursor-pointer items-center gap-2 text-sm text-foreground">
									<input
										type="radio"
										name="add-event-dialog-end-type"
										value="count"
										bind:group={endType}
										class="size-4 accent-primary"
									/>
									After
								</label>
								<Input
									type="number"
									min="1"
									bind:value={endCount}
									disabled={endType !== 'count'}
									class="w-24"
									aria-label="Occurrence count"
								/>
								<span class="text-sm text-muted-foreground">occurrences</span>
							</div>
							<div class="flex items-center gap-3">
								<label class="flex cursor-pointer items-center gap-2 text-sm text-foreground">
									<input
										type="radio"
										name="add-event-dialog-end-type"
										value="date"
										bind:group={endType}
										class="size-4 accent-primary"
									/>
									On date
								</label>
								<Input
									type="date"
									bind:value={endDate}
									disabled={endType !== 'date'}
									class="w-44"
									aria-label="End date"
								/>
							</div>
						</div>
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="add-event-assigned-to" text="Assigned To" />
					<Combobox
						id="add-event-assigned-to"
						items={userItems}
						bind:value={assignedTo}
						placeholder="Select User"
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

				{#if isEdit}
					<Alert
						variant="info"
						title="Schedule changes need approval"
						description="Edits to the date, time, duration, or repeat pattern are submitted as a change request instead of applying immediately."
					/>
				{/if}
			</div>
		</div>

		<div
			class="flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center md:px-6 {isEdit
				? 'sm:justify-between'
				: 'sm:justify-end'}"
		>
			{#if isEdit}
				<Button
					class="w-full sm:w-auto"
					variant="outline"
					label="Delete"
					icon={Trash2}
					disabled={isSaving}
					onclick={() => {
						deleteScope = 'current_only';
						deleteComment = '';
						deleteFormError = '';
						isDeleteOpen = true;
					}}
				/>
			{/if}
			<div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
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

<Dialog
	bind:open={isApprovalOpen}
	title="Request schedule change"
	confirmLabel="Submit request"
	onConfirm={submitScheduleApproval}
>
	<div class="flex flex-col gap-3">
		<div bind:this={approvalFormErrorAnchor}>
			{#if approvalFormError}
				<Alert
					variant="error"
					title="Could not submit change request"
					description={approvalFormError}
				/>
			{/if}
		</div>
		<p class="text-sm text-muted-foreground">
			You changed the event schedule. This is sent for approval and applies once approved; other
			field edits are saved immediately.
		</p>
		<div class="space-y-2">
			<Label for="add-event-approval-comment" text="Comment" />
			<Textarea
				id="add-event-approval-comment"
				bind:value={approvalComment}
				placeholder="Reason for the change (optional)"
			/>
		</div>
	</div>
</Dialog>

<Dialog
	bind:open={isDeleteOpen}
	title="Request event deletion"
	confirmLabel="Submit request"
	onConfirm={submitDeleteApproval}
>
	<div class="flex flex-col gap-3">
		<div bind:this={deleteFormErrorAnchor}>
			{#if deleteFormError}
				<Alert
					variant="error"
					title="Could not submit delete request"
					description={deleteFormError}
				/>
			{/if}
		</div>
		<p class="text-sm text-muted-foreground">
			Deleting an event is sent for approval and applies once approved.
		</p>
		{#if originalEvent?.rrule}
			<fieldset class="flex flex-col gap-2">
				<legend class="text-sm font-medium text-foreground">Delete</legend>
				<label class="flex cursor-pointer items-center gap-2 text-sm text-foreground">
					<input
						type="radio"
						name="add-event-dialog-delete-scope"
						value="current_only"
						bind:group={deleteScope}
						class="size-4 accent-primary"
					/>
					This occurrence only
				</label>
				<label class="flex cursor-pointer items-center gap-2 text-sm text-foreground">
					<input
						type="radio"
						name="add-event-dialog-delete-scope"
						value="entire_series"
						bind:group={deleteScope}
						class="size-4 accent-primary"
					/>
					The entire series
				</label>
			</fieldset>
		{/if}
		<div class="space-y-2">
			<Label for="add-event-delete-comment" text="Comment" />
			<Textarea
				id="add-event-delete-comment"
				bind:value={deleteComment}
				placeholder="Reason for deletion (optional)"
			/>
		</div>
	</div>
</Dialog>
