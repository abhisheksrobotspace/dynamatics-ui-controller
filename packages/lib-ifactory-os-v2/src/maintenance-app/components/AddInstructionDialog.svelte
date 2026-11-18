<script lang="ts">
	import { Alert, Button, Dialog, Input, Label, Skeleton, Textarea } from '@ifactory/ui-v2';
	import { createInstruction, getInstruction, updateInstruction } from '../lib/instructions.api.js';
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
		instructionId?: number | null;
		onSaved?: () => void;
		onClose?: () => void;
	};

	let { open = $bindable(false), instructionId = null, onSaved, onClose }: Props = $props();

	const isEdit = $derived(instructionId != null);

	let instructionText = $state('');
	let durationMinutes = $state('');
	let textError = $state(false);

	let dataReady = $state(false);
	let loadError = $state<string | null>(null);
	let formError = $state('');
	let formErrorAnchor = $state<HTMLElement | null>(null);
	let isSaving = $state(false);

	function resetForm() {
		instructionText = '';
		durationMinutes = '';
		textError = false;
		dataReady = false;
		loadError = null;
		formError = '';
		isSaving = false;
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
		textError = !instructionText.trim();
		if (textError) {
			formError = 'Instruction text is required.';
			void focusFormError(formErrorAnchor);
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const input = {
				instruction_text: instructionText.trim(),
				estimated_duration_minutes: parseInt(durationMinutes, 10) || 0
			};
			if (isEdit && instructionId != null) {
				await updateInstruction(instructionId, input);
				pushSuccessToast({ title: 'Instruction updated.' });
			} else {
				await createInstruction(input);
				pushSuccessToast({ title: 'Instruction added.' });
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
		instructionText = '';
		durationMinutes = '';
		textError = false;

		try {
			if (editId != null) {
				const instruction = await getInstruction(editId, controller.signal);
				if (!instruction) {
					loadError = 'Instruction not found.';
					return;
				}
				instructionText = instruction.instruction_text;
				durationMinutes = String(instruction.estimated_duration_minutes || '');
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
		void loadForm(instructionId);
		return () => cancelLoad();
	});
</script>

<!-- Custom footer: default Dialog footer auto-closes on confirm. -->
<Dialog
	bind:open
	title={isEdit ? 'Edit Instruction' : 'Add Instruction'}
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
			<Alert variant="error" title="Could not load instruction" description={loadError} />
		</div>
		<div class={MAINTENANCE_DIALOG_FOOTER_CLASS}>
			<Button class="w-full sm:w-auto" variant="outline" label="Cancel" onclick={handleCancel} />
		</div>
	{:else if !dataReady}
		<div class={MAINTENANCE_DIALOG_BODY_SCROLL_CLASS} aria-busy="true" role="status">
			<span class="sr-only">Loading form</span>
			<div class="space-y-4">
				<Skeleton class="h-24 w-full" />
				<Skeleton class="h-10 w-full" />
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
							title={isEdit ? 'Could not update instruction' : 'Could not create instruction'}
							description={formError}
						/>
					{/if}
				</div>
				<div class="space-y-2">
					<Label for="instruction-dialog-text" text="Instruction Text" required />
					<Textarea
						id="instruction-dialog-text"
						class="resize-none"
						bind:value={instructionText}
						oninput={() => {
							textError = false;
							formError = '';
						}}
						placeholder="Enter instruction details"
						rows={4}
						error={textError}
					/>
				</div>

				<div class="space-y-2">
					<Label for="instruction-dialog-duration" text="Estimated Duration (Minutes)" />
					<Input
						id="instruction-dialog-duration"
						type="number"
						min="0"
						bind:value={durationMinutes}
						placeholder="e.g. 30"
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
