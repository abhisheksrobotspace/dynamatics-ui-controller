<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { ToggleSize } from './toggle.constants';
	import { toggleInputClass, toggleThumbClass, toggleTrackClass } from './toggle.styles';

	type Props = {
		ref?: HTMLInputElement | null;
		checked?: boolean;
		size?: ToggleSize;
		class?: string;
		onCheckedChange?: (checked: boolean) => void;
	} & Omit<HTMLInputAttributes, 'size' | 'type'>;

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		size = 'md',
		disabled = false,
		class: className = '',
		onCheckedChange,
		onchange,
		...rest
	}: Props = $props();

	const trackClass = $derived(toggleTrackClass(size, checked, Boolean(disabled), className));
	const thumbClass = $derived(toggleThumbClass(size, checked));

	function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
		onchange?.(event);
		onCheckedChange?.(event.currentTarget.checked);
	}
</script>

<div class={trackClass}>
	<span class={thumbClass} aria-hidden="true"></span>
	<input
		bind:this={ref}
		type="checkbox"
		bind:checked
		{disabled}
		class={toggleInputClass}
		onchange={handleChange}
		{...rest}
	/>
</div>
