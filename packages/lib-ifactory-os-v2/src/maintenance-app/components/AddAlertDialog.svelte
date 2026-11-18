<script lang="ts">
	import { Alert, Button, Dialog, Input, Label, Skeleton, Textarea } from '@ifactory/ui-v2';
	import { createAlert, getAlert, updateAlert } from '../lib/alerts.api.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import {
		MAINTENANCE_DIALOG_BODY_SCROLL_CLASS,
		MAINTENANCE_DIALOG_CLASS_MD,
		MAINTENANCE_DIALOG_FOOTER_CLASS
	} from '../lib/dialog-layout.js';
	import { focusFormError } from '../lib/focus-form-error.js';
	import { pushSuccessToast } from '../lib/toast.js';

	type Props = {
		open?: boolean;
		alertId?: number | null;
		onSaved?: () => void;
		onClose?: () => void;
	};

	let { open = $bindable(false), alertId = null, onSaved, onClose }: Props = $props();

	const isEdit = $derived(alertId != null);

	let name = $state('');
	let description = $state('');
	let nameError = $state(false);

	let dataReady = $state(false);
	let loadError = $state<string | null>(null);
	let formError = $state('');
	let formErrorAnchor = $state<HTMLElement | null>(null);
	let isSaving = $state(false);

	function resetForm() {
		name = '';
		description = '';
		nameError = false;
		dataReady = false;
		loadError = null;
		formError = '';
		isSaving = false;
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
		name = '';
		description = '';
		nameError = false;

		try {
			if (editId != null) {
				const alert = await getAlert(editId, controller.signal);
				if (!alert) {
					loadError = 'Alert not found.';
					return;
				}
				name = alert.name;
				description = alert.description ?? '';
			}
		} catch (error) {
			if (isAbortError(error)) return;
			loadError = formatErrorMessage(error);
		} finally {
			if (!controller.signal.aborted) dataReady = true;
		}
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
		nameError = !name.trim();
		if (nameError) {
			formError = 'Alert name is required.';
			void focusFormError(formErrorAnchor);
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const input = { name: name.trim(), description: description.trim() };
			if (isEdit && alertId != null) {
				await updateAlert(alertId, input);
				pushSuccessToast({ title: 'Alert updated.' });
			} else {
				await createAlert(input);
				pushSuccessToast({ title: 'Alert added.' });
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

	$effect(() => {
		if (!open) return;
		void loadForm(alertId);
		return () => cancelLoad();
	});
</script>

<!-- Custom footer: default Dialog footer auto-closes on confirm. -->
<Dialog
	bind:open
	title={isEdit ? 'Edit Alert' : 'Add Alert'}
	size="md"
	hideFooter={true}
	class={MAINTENANCE_DIALOG_CLASS_MD}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
	closeOnBackdrop={!isSaving}
	showCloseButton={!isSaving}
	onOpenChange={handleOpenChange}
>
	{#if loadError}
		<div class={MAINTENANCE_DIALOG_BODY_SCROLL_CLASS}>
			<Alert variant="error" title="Could not load alert" description={loadError} />
		</div>
		<div class={MAINTENANCE_DIALOG_FOOTER_CLASS}>
			<Button class="w-full sm:w-auto" variant="outline" label="Cancel" onclick={handleCancel} />
		</div>
	{:else if !dataReady}
		<div class={MAINTENANCE_DIALOG_BODY_SCROLL_CLASS} aria-busy="true" role="status">
			<span class="sr-only">Loading form</span>
			<div class="space-y-4">
				<Skeleton class="h-10 w-full" />
				<Skeleton class="h-24 w-full" />
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
							title={isEdit ? 'Could not update alert' : 'Could not create alert'}
							description={formError}
						/>
					{/if}
				</div>
				<div class="space-y-2">
					<Label for="alert-dialog-name" text="Alert Name" required />
					<!-- v1: the name of an existing alert is immutable (magic ids depend on it). -->
					<Input
						id="alert-dialog-name"
						type="text"
						bind:value={name}
						oninput={() => {
							nameError = false;
							formError = '';
						}}
						placeholder="Scheduled"
						disabled={isEdit}
						error={nameError}
					/>
				</div>

				<div class="space-y-2">
					<Label for="alert-dialog-description" text="Description" />
					<Textarea
						id="alert-dialog-description"
						bind:value={description}
						placeholder="Add Description"
						rows={3}
					/>
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
				loading={isSaving}
				onclick={() => void handleSave()}
			/>
		</div>
	{/if}
</Dialog>
