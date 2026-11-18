<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { TriangleAlert, X } from '@lucide/svelte';
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
		actionLabel?: string;
		actionVariant?: DialogConfirmVariant;
		hideAction?: boolean;
		onAction?: () => void;
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
		actionLabel,
		actionVariant = 'danger',
		hideAction = false,
		onAction,
		class: className = '',
		panelClass = '',
		footerClass = '',
		titleId = 'alert-dialog-title',
		...rest
	}: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	const isXl = $derived(size === 'xl');
	const effectiveIconTone = $derived(iconTone ?? (icon ? undefined : 'danger'));
	const Icon = $derived(icon ?? TriangleAlert);
	const iconWrapClass = $derived(
		cn(dialogCenteredIconWrapClass(size), dialogIconToneClasses(effectiveIconTone), iconClass)
	);
	const showIcon = $derived(!hideIcon);
	const showAction = $derived(!hideAction && Boolean(actionLabel));
	const panelClasses = $derived(dialogPanelClass('centered', size, cn(className, panelClass)));

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function close() {
		setOpen(false);
	}

	function handleAction() {
		onAction?.();
		close();
	}

	function handleBackdropClick() {
		if (closeOnBackdrop) close();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!open || !showAction || !shouldConfirmDialogOnEnter(event)) return;

		event.preventDefault();
		handleAction();
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

			{#if showAction}
				<div class={cn(dialogFooterClass('centered', size), footerClass)}>
					<Button
						variant="primary"
						size={isXl ? 'lg' : 'md'}
						label={actionLabel}
						class={cn(
							'w-full',
							isXl && 'min-h-14 text-xl font-bold',
							actionVariant === 'danger' && 'bg-red-600 hover:bg-red-500'
						)}
						onclick={handleAction}
					/>
				</div>
			{/if}
		</div>
	</div>
</dialog>
