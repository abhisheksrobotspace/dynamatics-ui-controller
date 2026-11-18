<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import type { CardVariant } from '../card/card.styles';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/cn';
	import type { EmptyStateVariant } from './empty-state.constants';
	import {
		emptyStateActionWrapClass,
		emptyStateCardClass,
		emptyStateCardContentClass,
		emptyStateCardDashedContentClass,
		emptyStateDashedIconClass,
		emptyStateDashedTitleClass,
		emptyStateDescriptionClass,
		emptyStateIconClass,
		emptyStateRootClass,
		emptyStateTitleClass
	} from './empty-state.styles';

	type Props = {
		variant?: EmptyStateVariant;
		title?: string;
		description?: string;
		icon?: Component<{ class?: string }>;
		iconClass?: string;
		actionLabel?: string;
		actionIcon?: Component<{ class?: string }>;
		actionIconClass?: string;
		onAction?: () => void;
		inCard?: boolean;
		cardVariant?: CardVariant;
		cardClass?: string;
		class?: string;
		titleClass?: string;
		descriptionClass?: string;
	} & HTMLAttributes<HTMLDivElement> &
		HTMLButtonAttributes;

	let {
		variant = 'simple',
		title,
		description,
		icon: Icon,
		iconClass = '',
		actionLabel,
		actionIcon,
		actionIconClass = 'size-5',
		onAction,
		inCard = false,
		cardVariant = 'default',
		cardClass = '',
		class: className = '',
		titleClass = '',
		descriptionClass = '',
		onclick,
		type = 'button',
		...rest
	}: Props = $props();

	const isDashed = $derived(variant === 'dashed');
	const rootClass = $derived(emptyStateRootClass(variant, className));
	const cardClasses = $derived(emptyStateCardClass(cardVariant, cardClass));
	const cardContentClass = $derived(
		isDashed ? emptyStateCardDashedContentClass : emptyStateCardContentClass
	);
	const iconClasses = $derived(
		cn(isDashed ? emptyStateDashedIconClass : emptyStateIconClass, iconClass)
	);

	function handleAction(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		onclick?.(event);
		onAction?.();
	}
</script>

{#if inCard}
	<div class={cardClasses}>
		<div class={cardContentClass}>
			{#if isDashed}
				<button {type} class={rootClass} onclick={handleAction} {...rest}>
					{#if Icon}
						<Icon class={iconClasses} />
					{/if}
					{#if title}
						<span class={cn(emptyStateDashedTitleClass, titleClass)}>{title}</span>
					{/if}
				</button>
			{:else}
				<div class={rootClass} {...rest}>
					{#if Icon}
						<Icon class={iconClasses} />
					{/if}
					{#if title}
						<h3 class={cn(emptyStateTitleClass, titleClass)}>{title}</h3>
					{/if}
					{#if description}
						<p class={cn(emptyStateDescriptionClass, descriptionClass)}>{description}</p>
					{/if}
					{#if actionLabel}
						<div class={emptyStateActionWrapClass}>
							<Button
								variant="primary"
								label={actionLabel}
								icon={actionIcon}
								iconClass={actionIconClass}
								onclick={onAction}
							/>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else if isDashed}
	<button {type} class={rootClass} onclick={handleAction} {...rest}>
		{#if Icon}
			<Icon class={iconClasses} />
		{/if}
		{#if title}
			<span class={cn(emptyStateDashedTitleClass, titleClass)}>{title}</span>
		{/if}
	</button>
{:else}
	<div class={rootClass} {...rest}>
		{#if Icon}
			<Icon class={iconClasses} />
		{/if}
		{#if title}
			<h3 class={cn(emptyStateTitleClass, titleClass)}>{title}</h3>
		{/if}
		{#if description}
			<p class={cn(emptyStateDescriptionClass, descriptionClass)}>{description}</p>
		{/if}
		{#if actionLabel}
			<div class={emptyStateActionWrapClass}>
				<Button
					variant="primary"
					label={actionLabel}
					icon={actionIcon}
					iconClass={actionIconClass}
					onclick={onAction}
				/>
			</div>
		{/if}
	</div>
{/if}
