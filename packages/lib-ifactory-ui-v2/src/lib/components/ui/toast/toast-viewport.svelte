<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { fly } from 'svelte/transition';
	import { cn } from '$lib/utils/cn';
	import type { ToastPosition } from './toast.constants';
	import Toast from './toast.svelte';
	import { dismissToast, toastStack } from './toast-stack.svelte.ts';
	import {
		toastStackContainerClass,
		toastStackContainerHeight,
		toastStackFlyOffset,
		toastStackItemClass,
		toastStackItemStyle,
		toastViewportClass,
		toastViewportInnerClass
	} from './toast.styles';

	type Props = {
		embedded?: boolean;
		position?: ToastPosition;
		class?: string;
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		embedded = false,
		position = 'top-right',
		class: className = '',
		children,
		...rest
	}: Props = $props();

	let expanded = $state(false);
	let baseHeight = $state(0);

	const flyOffset = $derived(toastStackFlyOffset(position));

	function handleOpenChange(id: string, open: boolean) {
		if (!open) dismissToast(id);
	}

	function measureFrontToast(node: HTMLDivElement, isFront: boolean) {
		if (!isFront) return {};

		const update = () => {
			baseHeight = node.offsetHeight;
		};

		update();
		const observer = new ResizeObserver(update);
		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	$effect(() => {
		if (toastStack.length === 0) {
			expanded = false;
		}
	});
</script>

<div aria-live="assertive" class={cn(toastViewportClass(embedded, position, className))} {...rest}>
	<div class={toastViewportInnerClass(embedded, position)}>
		{#if !embedded && toastStack.length > 0}
			<div
				class={toastStackContainerClass(expanded, position)}
				style:height={toastStackContainerHeight(toastStack.length, baseHeight, expanded)}
				onmouseenter={() => (expanded = true)}
				onmouseleave={() => (expanded = false)}
				role="list"
			>
				{#each toastStack as toast, index (toast.id)}
					<div
						class={toastStackItemClass(expanded, index, position)}
						style={toastStackItemStyle(index, toastStack.length, expanded, baseHeight, position)}
						in:fly={{ y: flyOffset, duration: 250 }}
						out:fly={{ y: flyOffset, duration: 200 }}
					>
						<div class="w-full" use:measureFrontToast={index === 0}>
							<Toast
								open={true}
								onOpenChange={(open) => handleOpenChange(toast.id, open)}
								title={toast.title}
								description={toast.description}
								variant={toast.variant}
								icon={toast.icon}
								iconClass={toast.iconClass}
								iconAlign={toast.iconAlign}
								avatarSrc={toast.avatarSrc}
								avatarAlt={toast.avatarAlt}
								actions={toast.actions}
								actionPlacement={toast.actionPlacement}
								showDescription={toast.showDescription}
								showCloseButton={toast.showCloseButton}
								duration={toast.duration}
								onClose={toast.onClose}
							/>
						</div>
					</div>
				{/each}
			</div>
		{/if}
		{@render children?.()}
	</div>
</div>
