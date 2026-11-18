<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import {
		cardContentClass,
		cardDescriptionClass,
		cardFooterClass,
		cardHeaderClass,
		cardHeaderDividedClass,
		cardShellClasses,
		cardTitleClass,
		type CardVariant
	} from './card.styles';

	type Props = {
		variant?: CardVariant;
		class?: string;
		title?: string;
		description?: string;
		content?: string;
		footer?: string;
		headerDivided?: boolean;
		headerClass?: string;
		titleClass?: string;
		descriptionClass?: string;
		contentClass?: string;
		footerClass?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		variant = 'default',
		class: className = '',
		title,
		description,
		content,
		footer,
		headerDivided = false,
		headerClass = '',
		titleClass = '',
		descriptionClass = '',
		contentClass = '',
		footerClass = '',
		...rest
	}: Props = $props();

	const hasHeader = $derived(Boolean(title || description));
</script>

<div class={cardShellClasses(variant, className)} {...rest}>
	{#if hasHeader}
		<div class={cn(cardHeaderClass, headerDivided && cardHeaderDividedClass, headerClass)}>
			{#if title}
				<h3 class={cn(cardTitleClass, titleClass)}>{title}</h3>
			{/if}
			{#if description}
				<p class={cn(cardDescriptionClass, 'mt-1', descriptionClass)}>{description}</p>
			{/if}
		</div>
	{/if}

	{#if content}
		<div class={cn(cardContentClass, hasHeader ? 'pt-0' : 'pt-4', contentClass)}>
			{content}
		</div>
	{/if}

	{#if footer}
		<div class={cn(cardFooterClass, footerClass)}>
			{footer}
		</div>
	{/if}
</div>
