<script lang="ts">
	import { ArrowUp, Delete } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils/cn';
	import type { KeyboardKeyDef, KeyboardKeyVariant } from './keyboard.constants';
	import { keyboardIconClass, keyboardKeyClass } from './keyboard.styles';
	import { isLetterChar } from './keyboard.utils';

	type Props = {
		keyDef: KeyboardKeyDef;
		uppercaseMode?: boolean;
		capsLock?: boolean;
		disabled?: boolean;
		onpress?: (keyDef: KeyboardKeyDef) => void;
	};

	let {
		keyDef,
		uppercaseMode = false,
		capsLock = false,
		disabled = false,
		onpress
	}: Props = $props();

	const styleVariant = $derived.by((): KeyboardKeyVariant => {
		if (keyDef.variant === 'done') return 'done';
		if (keyDef.id === 'shift' && uppercaseMode) return 'active';
		if (keyDef.variant === 'active') return 'active';
		if (keyDef.variant === 'muted') return 'muted';
		return 'default';
	});

	const label = $derived.by(() => {
		if (keyDef.action.kind === 'char' && isLetterChar(keyDef.action.value)) {
			return uppercaseMode ? keyDef.action.value.toUpperCase() : keyDef.action.value.toLowerCase();
		}

		return keyDef.label;
	});

	const ariaLabel = $derived.by(() => {
		if (keyDef.action.kind === 'shift' && capsLock) return 'Caps lock on';
		return keyDef.ariaLabel ?? keyDef.label;
	});

	const buttonVariant = $derived(styleVariant === 'done' ? 'primary' : 'ghost');

	const keyIcon = $derived(
		keyDef.action.kind === 'backspace'
			? Delete
			: keyDef.action.kind === 'shift'
				? ArrowUp
				: undefined
	);

	const keyIconClass = $derived(
		keyDef.action.kind === 'shift' && uppercaseMode
			? cn(keyboardIconClass, '!text-[#F26522]')
			: keyboardIconClass
	);

	const keyClass = $derived(
		cn(
			keyboardKeyClass(styleVariant),
			'!rounded-none !px-0',
			styleVariant === 'done' && 'hover:!bg-[#F26522]/90 active:!bg-[#D9561F]',
			styleVariant === 'active' &&
				'!bg-[#F5F6F8] !text-[#F26522] hover:!bg-[#ECEEF0] active:!bg-[#DDE1E5]',
			styleVariant === 'muted' &&
				'!bg-[#F5F6F8] !text-[#1B2028] hover:!bg-[#ECEEF0] active:!bg-[#DDE1E5]',
			styleVariant === 'default' &&
				'!bg-white !text-[#1B2028] hover:!bg-[#F5F6F8] active:!bg-[#DDE1E5]'
		)
	);

	function handlePress() {
		onpress?.(keyDef);
	}
</script>

<Button
	variant={buttonVariant}
	size="md"
	label={keyIcon ? undefined : label}
	icon={keyIcon}
	iconClass={keyIconClass}
	class={keyClass}
	{disabled}
	aria-label={ariaLabel}
	onclick={handlePress}
/>
