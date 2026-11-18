<script lang="ts">
	import { deleteAtCaret, insertAtCaret } from '../keyboard/keyboard.utils';
	import { Delete } from '@lucide/svelte';
	import HmiKey from './hmi-key.svelte';
	import { hmiNumpadClass } from './hmi.styles';
	import { clearInput } from './hmi.utils';

	type Props = {
		/** Fallback string buffer when no `inputElement` is connected. */
		value?: string;
		/** Target input — preferred over `bind:value`. */
		inputElement?: HTMLInputElement | HTMLTextAreaElement | null;
		/** Enables "." for decimal fields (kg, mm); integer fields keep it disabled. */
		decimal?: boolean;
		enterLabel?: string;
		enterDisabled?: boolean;
		disabled?: boolean;
		class?: string;
		onEnter?: () => void;
	};

	let {
		value = $bindable(''),
		inputElement = null,
		decimal = false,
		enterLabel = 'ENTER',
		enterDisabled = false,
		disabled = false,
		class: className = '',
		onEnter
	}: Props = $props();

	const DIGIT_ROWS = [
		['7', '8', '9'],
		['4', '5', '6'],
		['1', '2', '3']
	] as const;

	function write(char: string) {
		if (inputElement) insertAtCaret(inputElement, char);
		else value += char;
	}

	function backspace() {
		if (inputElement) deleteAtCaret(inputElement);
		else value = value.slice(0, -1);
	}

	function clear() {
		if (inputElement) clearInput(inputElement);
		else value = '';
	}
</script>

<div class={hmiNumpadClass(className)} role="group" aria-label="Numeric keypad" data-hmi-keypad>
	{#each DIGIT_ROWS as row, rowIndex (rowIndex)}
		{#each row as digit (digit)}
			<HmiKey label={digit} size="lg" {disabled} onpress={() => write(digit)} />
		{/each}
		{#if rowIndex === 0}
			<HmiKey
				label="DEL"
				icon={Delete}
				tone="function"
				size="lg"
				aria-label="Delete"
				repeat
				{disabled}
				onpress={backspace}
			/>
		{:else if rowIndex === 1}
			<HmiKey
				label="CLEAR"
				tone="function"
				size="lg"
				legendClass="text-[22px]"
				{disabled}
				onpress={clear}
			/>
		{:else}
			<HmiKey
				label={enterLabel}
				tone="action"
				size="lg"
				class="row-span-2"
				disabled={disabled || enterDisabled}
				onpress={() => onEnter?.()}
			/>
		{/if}
	{/each}
	<HmiKey label="0" size="lg" class="col-span-2" {disabled} onpress={() => write('0')} />
	<HmiKey label="." size="lg" disabled={disabled || !decimal} onpress={() => write('.')} />
</div>
