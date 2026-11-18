<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { CheckCircle2, Info, TriangleAlert, X, XCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/cn';
	import type { AlertAction, AlertLink, AlertVariant } from './alert.constants';
	import {
		alertAccentTextClass,
		alertActionButtonClass,
		alertActionButtonSpacingClass,
		alertActionsRowClass,
		alertActionsWrapClass,
		alertBodyClass,
		alertContentClass,
		alertDismissButtonClass,
		alertDismissButtonWrapClass,
		alertDismissTitleClass,
		alertDismissWrapClass,
		alertIconClass,
		alertInlineLinkClass,
		alertLinkClass,
		alertLinkRightActionClass,
		alertLinkRightContentClass,
		alertLinkRightTextClass,
		alertListClass,
		alertPanelClass,
		alertTitleClass
	} from './alert.styles';

	const defaultIcons = {
		success: CheckCircle2,
		warning: TriangleAlert,
		error: XCircle,
		info: Info
	} satisfies Record<AlertVariant, Component<{ class?: string }>>;

	type Props = {
		variant?: AlertVariant;
		title?: string;
		description?: string;
		items?: string[];
		actions?: AlertAction[];
		link?: AlertLink;
		inlineLink?: AlertLink;
		accentBorder?: boolean;
		dismissible?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		onDismiss?: () => void;
		icon?: Component<{ class?: string }>;
		iconClass?: string;
		class?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		variant = 'info',
		title,
		description,
		items = [],
		actions = [],
		link,
		inlineLink,
		accentBorder = false,
		dismissible = false,
		open = $bindable(true),
		onOpenChange,
		onDismiss,
		icon: Icon,
		iconClass = '',
		class: className = '',
		...rest
	}: Props = $props();

	const isLinkRight = $derived(Boolean(link));
	const isAccentBorder = $derived(accentBorder);
	const isList = $derived(items.length > 0);
	const hasActions = $derived(actions.length > 0);
	const showDismiss = $derived(dismissible);
	const isDescriptionOnly = $derived(
		Boolean(description) &&
			!title &&
			!isList &&
			!hasActions &&
			!showDismiss &&
			!isLinkRight &&
			!isAccentBorder
	);

	const panelClass = $derived(alertPanelClass(variant, isAccentBorder, className));
	const iconClasses = $derived(cn(alertIconClass(variant), iconClass));
	const DefaultIcon = $derived(Icon ?? defaultIcons[variant]);
	const rowClass = $derived(cn('flex', isDescriptionOnly ? 'items-center' : 'items-start'));

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function dismiss() {
		onDismiss?.();
		setOpen(false);
	}

	function handleAction(action: AlertAction) {
		action.onclick?.();
	}

	function handleLinkClick(event: MouseEvent, linkConfig: AlertLink) {
		linkConfig.onclick?.(event);
	}
</script>

{#if open}
	<div class={panelClass} role="alert" {...rest}>
		<div class={rowClass}>
			<div class="shrink-0">
				<DefaultIcon class={iconClasses} />
			</div>

			{#if isLinkRight}
				<div class={alertLinkRightContentClass}>
					{#if description}
						<p class={alertLinkRightTextClass(variant)}>{description}</p>
					{:else if title}
						<p class={alertLinkRightTextClass(variant)}>{title}</p>
					{/if}

					{#if link}
						<p class={alertLinkRightActionClass}>
							{#if link.href}
								<a href={link.href} class={alertLinkClass(variant)}>
									{link.label}
									{#if link.showArrow ?? true}
										<span aria-hidden="true"> &rarr;</span>
									{/if}
								</a>
							{:else}
								<button
									type="button"
									class={alertLinkClass(variant)}
									onclick={(event) => handleLinkClick(event, link)}
								>
									{link.label}
									{#if link.showArrow ?? true}
										<span aria-hidden="true"> &rarr;</span>
									{/if}
								</button>
							{/if}
						</p>
					{/if}
				</div>
			{:else if isAccentBorder}
				<div class={alertContentClass}>
					<p class={alertAccentTextClass(variant)}>
						{#if description}
							{description}
						{:else if title}
							{title}
						{/if}
						{#if inlineLink}
							{#if inlineLink.href}
								<a href={inlineLink.href} class={cn(alertInlineLinkClass(variant), 'ms-1')}>
									{inlineLink.label}
								</a>
							{:else}
								<button
									type="button"
									class={cn(alertInlineLinkClass(variant), 'ms-1')}
									onclick={(event) => handleLinkClick(event, inlineLink)}
								>
									{inlineLink.label}
								</button>
							{/if}
						{/if}
					</p>
				</div>
			{:else if showDismiss}
				<div class={alertContentClass}>
					{#if title}
						<p class={alertDismissTitleClass(variant)}>{title}</p>
					{/if}
					{#if description}
						<div class={cn(alertBodyClass(variant), !title && 'mt-0')}>
							<p>{description}</p>
						</div>
					{/if}
				</div>

				<div class={alertDismissWrapClass}>
					<div class={alertDismissButtonWrapClass}>
						<Button
							variant="ghost"
							size="icon"
							icon={X}
							iconClass="size-5"
							class={alertDismissButtonClass(variant)}
							aria-label="Dismiss"
							onclick={dismiss}
						/>
					</div>
				</div>
			{:else}
				<div class={alertContentClass}>
					{#if title}
						<h3 class={alertTitleClass(variant)}>{title}</h3>
					{/if}

					{#if isList}
						<div class={alertBodyClass(variant)}>
							<ul role="list" class={alertListClass}>
								{#each items as item (item)}
									<li>{item}</li>
								{/each}
							</ul>
						</div>
					{:else if description}
						<div class={cn(alertBodyClass(variant), !title && 'mt-0')}>
							<p class="m-0">{description}</p>
						</div>
					{/if}

					{#if hasActions}
						<div class={alertActionsWrapClass}>
							<div class={alertActionsRowClass}>
								{#each actions as action, index (action.label)}
									<Button
										variant="ghost"
										size="sm"
										label={action.label}
										class={cn(
											alertActionButtonClass(variant),
											index > 0 && alertActionButtonSpacingClass
										)}
										onclick={() => handleAction(action)}
									/>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
