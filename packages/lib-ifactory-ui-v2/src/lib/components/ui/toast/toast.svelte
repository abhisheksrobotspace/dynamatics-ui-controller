<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { X } from '@lucide/svelte';
	import { Avatar } from '$lib/components/ui/avatar';
	import { cn } from '$lib/utils/cn';
	import type {
		ToastAction,
		ToastActionPlacement,
		ToastIconAlign,
		ToastVariant
	} from './toast.constants';
	import {
		toastActionButtonClass,
		toastAvatarActionsClass,
		toastAvatarClass,
		toastBelowActionsClass,
		toastCloseButtonClassForVariant,
		toastContentClass,
		toastDescriptionClassForVariant,
		toastInlineActionButtonClass,
		toastLeadingOffsetClass,
		toastPanelClass,
		toastRowClass,
		toastSideActionButtonClass,
		toastSideActionWrapClass,
		toastSideContentClass,
		toastTitleClassForVariant
	} from './toast.styles';

	type Props = {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		title: string;
		description?: string;
		variant?: ToastVariant;
		icon?: Component<{ class?: string }>;
		iconClass?: string;
		iconAlign?: ToastIconAlign;
		avatarSrc?: string;
		avatarAlt?: string;
		actions?: ToastAction[];
		actionPlacement?: ToastActionPlacement;
		showDescription?: boolean;
		showCloseButton?: boolean;
		duration?: number;
		onClose?: () => void;
		children?: Snippet;
		class?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		open = $bindable(true),
		onOpenChange,
		title,
		description,
		variant = 'default',
		icon: Icon,
		iconClass = 'size-6 text-gray-400',
		iconAlign = 'start',
		avatarSrc,
		avatarAlt = '',
		actions = [],
		actionPlacement = 'below',
		showDescription,
		showCloseButton,
		duration,
		onClose,
		children,
		class: className = '',
		...rest
	}: Props = $props();

	const isSideLayout = $derived(actionPlacement === 'side');
	const isCondensedLayout = $derived(actionPlacement === 'inline');
	const showAvatar = $derived(Boolean(avatarSrc));
	const showIcon = $derived(Boolean(Icon) && !showAvatar);
	const effectiveShowDescription = $derived(Boolean(description) && (showDescription ?? true));
	const showBelowActions = $derived(actions.length > 0 && actionPlacement === 'below');
	const showInlineActions = $derived(actions.length > 0 && isCondensedLayout);
	const showSideAction = $derived(actions.length > 0 && isSideLayout);
	const effectiveShowClose = $derived(showCloseButton ?? !isSideLayout);
	const belowActionsClass = $derived(showAvatar ? toastAvatarActionsClass : toastBelowActionsClass);
	const rowClass = $derived(toastRowClass(iconAlign));
	const leadingOffsetClass = $derived(toastLeadingOffsetClass(iconAlign));

	const panelClass = $derived(toastPanelClass(actionPlacement, className, variant));
	const titleClass = $derived(toastTitleClassForVariant(variant));
	const descriptionClass = $derived(toastDescriptionClassForVariant(variant));
	const closeButtonClass = $derived(toastCloseButtonClassForVariant(variant));

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function close() {
		onClose?.();
		setOpen(false);
	}

	function handleAction(action: ToastAction) {
		action.onclick?.();
		close();
	}

	$effect(() => {
		if (!open || duration == null || duration <= 0) return;

		const timer = setTimeout(close, duration);
		return () => clearTimeout(timer);
	});
</script>

{#if open}
	<div class={panelClass} {...rest}>
		{#if isSideLayout}
			<div class={toastSideContentClass}>
				<div class={rowClass}>
					{#if showAvatar}
						<div class={cn('shrink-0', leadingOffsetClass)}>
							<Avatar src={avatarSrc} alt={avatarAlt} size="lg" class={toastAvatarClass} />
						</div>
					{/if}
					<div class="ml-3 w-0 flex-1">
						<p class={titleClass}>{title}</p>
						{#if effectiveShowDescription}
							<p class={descriptionClass}>{description}</p>
						{/if}
					</div>
				</div>
			</div>
			{#if showSideAction}
				<div class={toastSideActionWrapClass}>
					{#each actions as action (action.label)}
						<button
							type="button"
							class={toastSideActionButtonClass}
							onclick={() => handleAction(action)}
						>
							{action.label}
						</button>
					{/each}
				</div>
			{/if}
		{:else if isCondensedLayout}
			<div class={toastContentClass}>
				<div class="flex items-center">
					<div class="flex w-0 flex-1 justify-between">
						<p class={cn(titleClass, 'w-0 flex-1')}>{title}</p>
						{#if showInlineActions}
							{#each actions as action (action.label)}
								<button
									type="button"
									class={toastInlineActionButtonClass}
									onclick={() => handleAction(action)}
								>
									{action.label}
								</button>
							{/each}
						{/if}
					</div>
					{#if effectiveShowClose}
						<div class="ml-4 flex shrink-0">
							<button type="button" class={closeButtonClass} aria-label="Close" onclick={close}>
								<X class="size-5" aria-hidden="true" />
							</button>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class={toastContentClass}>
				<div class="flex items-start">
					<div class={cn('flex min-w-0 flex-1', rowClass)}>
						{#if showIcon}
							<div class={cn('shrink-0', leadingOffsetClass)}>
								<Icon class={iconClass} />
							</div>
						{:else if showAvatar}
							<div class={cn('shrink-0', leadingOffsetClass)}>
								<Avatar src={avatarSrc} alt={avatarAlt} size="lg" class={toastAvatarClass} />
							</div>
						{/if}

						<div class={cn('ml-3 w-0 flex-1', leadingOffsetClass)}>
							<p class={titleClass}>{title}</p>
							{#if effectiveShowDescription}
								<p class={descriptionClass}>{description}</p>
							{/if}
							{#if showBelowActions}
								<div class={belowActionsClass}>
									{#each actions as action, index (action.label)}
										<button
											type="button"
											class={cn(
												toastActionButtonClass(action.variant),
												index > 0 && action.variant !== 'text' && 'ml-3',
												action.class
											)}
											onclick={() => handleAction(action)}
										>
											{action.label}
										</button>
									{/each}
								</div>
							{/if}
							{@render children?.()}
						</div>
					</div>

					{#if effectiveShowClose}
						<div class="ml-4 flex shrink-0">
							<button type="button" class={closeButtonClass} aria-label="Close" onclick={close}>
								<X class="size-5" aria-hidden="true" />
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
