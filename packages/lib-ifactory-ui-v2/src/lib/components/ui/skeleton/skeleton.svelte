<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { skeletonClass } from './skeleton.styles';

	type Props = {
		animated?: boolean;
		class?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let { animated = true, class: className = '', ...rest }: Props = $props();

	const classes = $derived(skeletonClass(animated, className));
</script>

<div class={classes} aria-hidden="true" {...rest}></div>
