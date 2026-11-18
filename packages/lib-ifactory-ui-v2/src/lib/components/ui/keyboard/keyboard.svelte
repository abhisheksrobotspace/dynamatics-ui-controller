<script lang="ts">
	import {
		LETTER_ROWS,
		SYMBOL_ROWS,
		type KeyboardKeyDef,
		type KeyboardLayout
	} from './keyboard.constants';
	import KeyboardKey from './keyboard-key.svelte';
	import { keyboardRowClass, keyboardTrayClass, KEYBOARD_VIEWPORT_STYLE } from './keyboard.styles';
	import {
		applyLetterCase,
		deleteAtCaret,
		insertAtCaret,
		SHIFT_DOUBLE_TAP_MS
	} from './keyboard.utils';

	type Props = {
		/** Fallback string buffer when no `inputElement` is connected. */
		value?: string;
		layout?: KeyboardLayout;
		/** Target input — preferred over `bind:value`. */
		inputElement?: HTMLInputElement | HTMLTextAreaElement | null;
		loading?: boolean;
		class?: string;
		onDone?: () => void;
		onLayoutChange?: (layout: KeyboardLayout) => void;
	};

	let {
		value = $bindable(''),
		layout = $bindable('letters'),
		inputElement = null,
		loading = false,
		class: className = '',
		onDone,
		onLayoutChange
	}: Props = $props();

	let shiftActive = $state(false);
	let capsLock = $state(false);
	let lastShiftPressAt = 0;

	const uppercaseMode = $derived(shiftActive || capsLock);
	const rows = $derived(layout === 'letters' ? LETTER_ROWS : SYMBOL_ROWS);

	function releaseShiftAfterInput() {
		if (!capsLock) shiftActive = false;
	}

	function appendChar(char: string) {
		const output = layout === 'letters' ? applyLetterCase(char, uppercaseMode) : char;

		if (inputElement) {
			insertAtCaret(inputElement, output);
			releaseShiftAfterInput();
			return;
		}

		value += output;
		releaseShiftAfterInput();
	}

	function handleBackspace() {
		if (inputElement) {
			deleteAtCaret(inputElement);
			return;
		}

		value = value.slice(0, -1);
	}

	function handleShift() {
		const now = Date.now();
		const isDoubleTap = now - lastShiftPressAt <= SHIFT_DOUBLE_TAP_MS;
		lastShiftPressAt = now;

		if (capsLock) {
			capsLock = false;
			shiftActive = false;
			return;
		}

		if (isDoubleTap) {
			capsLock = true;
			shiftActive = true;
			return;
		}

		shiftActive = !shiftActive;
	}

	function handleKeyPress(keyDef: KeyboardKeyDef) {
		switch (keyDef.action.kind) {
			case 'char':
				appendChar(keyDef.action.value);
				break;
			case 'backspace':
				handleBackspace();
				break;
			case 'shift':
				handleShift();
				break;
			case 'space':
				appendChar(' ');
				break;
			case 'toggle-layout':
				if (keyDef.id === 'symbols-active') return;
				layout = layout === 'letters' ? 'symbols' : 'letters';
				shiftActive = false;
				capsLock = false;
				onLayoutChange?.(layout);
				break;
			case 'done':
				onDone?.();
				break;
		}
	}
</script>

<div
	class={keyboardTrayClass(className)}
	style={KEYBOARD_VIEWPORT_STYLE}
	role="group"
	aria-label="On-screen keyboard"
>
	{#each rows as row (row.id)}
		<div
			class={keyboardRowClass(row.padding ?? 'default')}
			style:grid-template-columns={row.columns}
		>
			{#each row.keys as keyDef (keyDef.id)}
				<KeyboardKey
					{keyDef}
					{uppercaseMode}
					{capsLock}
					disabled={loading && keyDef.action.kind === 'done'}
					onpress={handleKeyPress}
				/>
			{/each}
		</div>
	{/each}
</div>
