<script lang="ts">
	import { deleteAtCaret, insertAtCaret } from '../keyboard/keyboard.utils';
	import HmiKey from './hmi-key.svelte';
	import {
		HMI_KEYBOARD_BLOCKS,
		type HmiKeyboardKeyDef,
		type HmiKeyboardLayout
	} from './hmi-keyboard.constants';
	import { hmiKeyboardBlockClass, hmiKeyboardClass } from './hmi.styles';

	type Props = {
		/** Fallback string buffer when no `inputElement` is connected. */
		value?: string;
		layout?: HmiKeyboardLayout;
		capsLock?: boolean;
		/** Target input — preferred over `bind:value`. */
		inputElement?: HTMLInputElement | HTMLTextAreaElement | null;
		/** Legend of the orange action key, e.g. NEXT or LOG IN. */
		doneLabel?: string;
		loading?: boolean;
		class?: string;
		onDone?: () => void;
		onLayoutChange?: (layout: HmiKeyboardLayout) => void;
	};

	let {
		value = $bindable(''),
		layout = $bindable('letters'),
		capsLock = $bindable(false),
		inputElement = null,
		doneLabel = 'ENTER',
		loading = false,
		class: className = '',
		onDone,
		onLayoutChange
	}: Props = $props();

	const blocks = $derived(HMI_KEYBOARD_BLOCKS[layout]);

	function isLetter(char: string) {
		return /^[a-z]$/.test(char);
	}

	function legendFor(keyDef: HmiKeyboardKeyDef): string | undefined {
		if (keyDef.action.kind === 'done') return doneLabel;
		if (keyDef.action.kind === 'char' && isLetter(keyDef.action.value)) {
			return capsLock ? keyDef.action.value.toUpperCase() : keyDef.action.value;
		}
		return keyDef.label;
	}

	function write(text: string) {
		if (inputElement) {
			insertAtCaret(inputElement, text);
			return;
		}
		value += text;
	}

	function handlePress(keyDef: HmiKeyboardKeyDef) {
		const action = keyDef.action;
		switch (action.kind) {
			case 'char':
				write(capsLock && isLetter(action.value) ? action.value.toUpperCase() : action.value);
				break;
			case 'space':
				write(' ');
				break;
			case 'backspace':
				if (inputElement) deleteAtCaret(inputElement);
				else value = value.slice(0, -1);
				break;
			case 'caps':
				capsLock = !capsLock;
				break;
			case 'layout':
				layout = action.to;
				onLayoutChange?.(layout);
				break;
			case 'done':
				onDone?.();
				break;
		}
	}
</script>

<div
	class={hmiKeyboardClass(className)}
	role="group"
	aria-label="On-screen keyboard"
	data-hmi-keypad
>
	{#each blocks as block (block.id)}
		<div
			class={hmiKeyboardBlockClass}
			style:flex-grow={block.grow}
			style:grid-template-columns="repeat({block.columns}, minmax(0, 1fr))"
		>
			{#each block.keys as keyDef (keyDef.id)}
				<HmiKey
					label={legendFor(keyDef)}
					icon={keyDef.icon}
					tone={keyDef.tone}
					led={keyDef.action.kind === 'caps' ? capsLock : undefined}
					disabled={loading && keyDef.action.kind === 'done'}
					repeat={keyDef.action.kind === 'backspace'}
					aria-label={keyDef.ariaLabel ?? legendFor(keyDef)}
					aria-pressed={keyDef.action.kind === 'caps' ? capsLock : undefined}
					style={keyDef.span ? `grid-column: span ${keyDef.span} / span ${keyDef.span}` : undefined}
					onpress={() => handlePress(keyDef)}
				/>
			{/each}
		</div>
	{/each}
</div>
