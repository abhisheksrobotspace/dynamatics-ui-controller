<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { CheckboxSize } from './checkbox.constants';
	import { checkboxBoxClass, checkboxInputClass } from './checkbox.styles';

	type Props = {
		ref?: HTMLInputElement | null;
		checked?: boolean;
		indeterminate?: boolean;
		size?: CheckboxSize;
		class?: string;
		onCheckedChange?: (checked: boolean) => void;
	} & Omit<HTMLInputAttributes, 'size' | 'type'>;

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		size = 'md',
		disabled = false,
		class: className = '',
		onCheckedChange,
		onchange,
		...rest
	}: Props = $props();

	const boxClass = $derived(
		checkboxBoxClass(size, checked, indeterminate, Boolean(disabled), className)
	);

	function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
		indeterminate = false;
		onchange?.(event);
		onCheckedChange?.(event.currentTarget.checked);
	}

	/** Prevent focus-on-mousedown — browsers scroll every overflow ancestor to the focused box. */
	function handleMouseDown(event: MouseEvent) {
		event.preventDefault();
	}

	$effect(() => {
		if (ref) {
			ref.indeterminate = indeterminate;
		}
	});
</script>

<div class={boxClass}>
	<input
		bind:this={ref}
		type="checkbox"
		bind:checked
		{disabled}
		class={checkboxInputClass}
		{...rest}
		onmousedown={handleMouseDown}
		onchange={handleChange}
	/>
</div>
