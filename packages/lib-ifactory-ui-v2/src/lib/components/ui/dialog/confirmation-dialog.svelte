<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { Check, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/cn';
	import type { DialogConfirmVariant, DialogIconTone, DialogSize } from './dialog.constants';
	import {
		dialogAlertCloseClass,
		dialogBackdropClass,
		dialogCenteredContentClass,
		dialogCenteredDescriptionClass,
		dialogCenteredIconWrapClass,
		dialogCenteredTitleClass,
		dialogFooterClass,
		dialogIconToneClasses,
		dialogPanelClass,
		dialogPositionerClass,
		dialogCancelButtonClass,
		dialogConfirmButtonClass,
		dialogShellClass
	} from './dialog.styles';
	import { shouldConfirmDialogOnEnter } from './dialog.utils';

	type Props = {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		size?: DialogSize;
		title?: string;
		description?: string;
		icon?: Component<{ class?: string }>;
		iconTone?: DialogIconTone;
		iconClass?: string;
		hideIcon?: boolean;
		showCloseButton?: boolean;
		closeOnBackdrop?: boolean;
		cancelLabel?: string;
		confirmLabel?: string;
		confirmVariant?: DialogConfirmVariant;
		hideFooter?: boolean;
		onCancel?: () => void;
		onConfirm?: () => void | Promise<void>;
		class?: string;
		panelClass?: string;
		footerClass?: string;
		titleId?: string;
	} & HTMLAttributes<HTMLDialogElement>;

	let {
		open = $bindable(false),
		onOpenChange,
		size = 'md',
		title,
		description,
		icon,
		iconTone,
		iconClass = '',
		hideIcon = false,
		showCloseButton = true,
		closeOnBackdrop = true,
		cancelLabel = 'Cancel',
		confirmLabel = 'Confirm',
		confirmVariant = 'primary',
		hideFooter = false,
		onCancel,
		onConfirm,
		class: className = '',
		panelClass = '',
		footerClass = '',
		titleId = 'confirmation-dialog-title',
		...rest
	}: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let isConfirming = $state(false);

	const isXl = $derived(size === 'xl');
	const effectiveIconTone = $derived(iconTone ?? (icon ? undefined : 'success'));
	const Icon = $derived(icon ?? Check);
	const iconWrapClass = $derived(
		cn(dialogCenteredIconWrapClass(size), dialogIconToneClasses(effectiveIconTone), iconClass)
	);
	const showIcon = $derived(!hideIcon);
	const panelClasses = $derived(dialogPanelClass('centered-wide', size, cn(className, panelClass)));
	const canDismiss = $derived(!isConfirming);

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function close() {
		if (isConfirming) return;
		setOpen(false);
	}

	function handleCancel() {
		if (isConfirming) return;
		onCancel?.();
		close();
	}

	async function handleConfirm() {
		if (isConfirming) return;

		isConfirming = true;
		try {
			await onConfirm?.();
			setOpen(false);
		} catch {
			// Keep the dialog open so the user can retry or cancel.
		} finally {
			isConfirming = false;
		}
	}

	function handleBackdropClick() {
		if (closeOnBackdrop && canDismiss) close();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!open || hideFooter || isConfirming || !shouldConfirmDialogOnEnter(event)) return;

		event.preventDefault();
		void handleConfirm();
	}

	$effect(() => {
		if (!dialogEl) return;

		const handleClose = () => {
			if (open) setOpen(false);
		};

		dialogEl.addEventListener('close', handleClose);
		return () => dialogEl?.removeEventListener('close', handleClose);
	});

	$effect(() => {
		if (!dialogEl) return;

		if (open) {
			if (!dialogEl.open) dialogEl.showModal();
			return;
		}

		if (dialogEl.open) dialogEl.close();
	});
</script>

<dialog
	bind:this={dialogEl}
	class={dialogShellClass}
	aria-labelledby={title ? titleId : undefined}
	onkeydown={handleKeyDown}
	{...rest}
>
	<button
		type="button"
		class={cn(dialogBackdropClass, 'border-0 p-0')}
		aria-label="Close dialog"
		onclick={handleBackdropClick}
	></button>

	<div class={dialogPositionerClass}>
		<div class={panelClasses} role="document">
			{#if showCloseButton}
				<div class={dialogAlertCloseClass(size)}>
					<Button
						variant="ghost"
						size="icon"
						icon={X}
						aria-label="Close dialog"
						disabled={isConfirming}
						class={isXl ? 'size-11' : undefined}
						onclick={close}
					/>
				</div>
			{/if}

			<div>
				{#if showIcon}
					<div class={iconWrapClass}>
						<Icon class={isXl ? 'size-8' : 'size-6'} aria-hidden="true" />
					</div>
				{/if}
				<div class={showIcon ? dialogCenteredContentClass(size) : 'text-center'}>
					{#if title}
						<h2 id={titleId} class={dialogCenteredTitleClass(size)}>{title}</h2>
					{/if}
					{#if description}
						<div class={isXl ? 'mt-3' : 'mt-2'}>
							<p class={dialogCenteredDescriptionClass(size)}>{description}</p>
						</div>
					{/if}
				</div>
			</div>

			{#if !hideFooter}
				<div class={cn(dialogFooterClass('centered-wide', size), footerClass)}>
					<Button
						variant="primary"
						size={isXl ? 'lg' : 'md'}
						label={confirmLabel}
						loading={isConfirming}
						disabled={isConfirming}
						class={cn(
							dialogConfirmButtonClass('centered-wide'),
							isXl && 'min-h-14 text-xl font-bold',
							confirmVariant === 'danger' && 'bg-red-600 hover:bg-red-500'
						)}
						onclick={() => void handleConfirm()}
					/>
					<Button
						variant="outline"
						size={isXl ? 'lg' : 'md'}
						label={cancelLabel}
						disabled={isConfirming}
						class={cn(
							dialogCancelButtonClass('centered-wide'),
							isXl && 'min-h-14 text-xl font-bold'
						)}
						onclick={handleCancel}
					/>
				</div>
			{/if}
		</div>
	</div>
</dialog>
