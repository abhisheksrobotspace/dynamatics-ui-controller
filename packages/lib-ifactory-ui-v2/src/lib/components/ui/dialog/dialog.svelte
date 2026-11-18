<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/cn';
	import type { DialogSize } from './dialog.constants';
	import {
		contentBodyClass,
		contentButtonClass,
		contentFooterClass,
		contentHeaderClass,
		contentPanelClass,
		contentTitleClass,
		dialogBackdropClass,
		dialogPositionerClass,
		dialogShellClass
	} from './dialog.styles';
	import { shouldConfirmDialogOnEnter } from './dialog.utils';

	type Props = {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		title?: string;
		size?: DialogSize;
		showCloseButton?: boolean;
		closeOnBackdrop?: boolean;
		cancelLabel?: string;
		confirmLabel?: string;
		hideFooter?: boolean;
		onCancel?: () => void;
		onConfirm?: () => void;
		/** When false, confirming does not close the dialog; `onConfirm` closes it once it succeeds. */
		closeOnConfirm?: boolean;
		children?: Snippet;
		class?: string;
		headerClass?: string;
		bodyClass?: string;
		footerClass?: string;
		titleId?: string;
	} & HTMLAttributes<HTMLDialogElement>;

	let {
		open = $bindable(false),
		onOpenChange,
		title = 'Dialog',
		size = 'md',
		showCloseButton = true,
		closeOnBackdrop = true,
		cancelLabel = 'Cancel',
		confirmLabel = 'Apply',
		hideFooter = false,
		onCancel,
		onConfirm,
		closeOnConfirm = true,
		children,
		class: className = '',
		headerClass = '',
		bodyClass = '',
		footerClass = '',
		titleId = 'dialog-title',
		...rest
	}: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	const panelClasses = $derived(contentPanelClass(size, className));

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function close() {
		setOpen(false);
	}

	function handleCancel() {
		onCancel?.();
		close();
	}

	function handleConfirm() {
		onConfirm?.();
		if (closeOnConfirm) close();
	}

	function handleBackdropClick() {
		if (closeOnBackdrop) close();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!open || !shouldConfirmDialogOnEnter(event)) return;

		event.preventDefault();

		if (hideFooter) {
			onConfirm?.();
			return;
		}

		handleConfirm();
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
			{#if title || showCloseButton}
				<div class={cn(contentHeaderClass, !title && 'justify-end', headerClass)}>
					{#if title}
						<h2 id={titleId} class={contentTitleClass}>{title}</h2>
					{/if}
					{#if showCloseButton}
						<Button
							variant="ghost"
							size="icon"
							icon={X}
							aria-label="Close dialog"
							onclick={close}
						/>
					{/if}
				</div>
			{/if}

			<div class={cn(contentBodyClass, bodyClass)}>
				{@render children?.()}
			</div>

			{#if !hideFooter}
				<div class={cn(contentFooterClass, footerClass)}>
					<Button
						variant="outline"
						label={cancelLabel}
						class={contentButtonClass}
						onclick={handleCancel}
					/>
					<Button
						variant="primary"
						label={confirmLabel}
						class={contentButtonClass}
						onclick={handleConfirm}
					/>
				</div>
			{/if}
		</div>
	</div>
</dialog>
