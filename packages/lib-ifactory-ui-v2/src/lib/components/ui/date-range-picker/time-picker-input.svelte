<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import {
		dateRangePickerMeridiemButtonClass,
		dateRangePickerTimeDividerClass,
		dateRangePickerTimeFieldClass,
		dateRangePickerTimeInputClass,
		dateRangePickerTimeWrapClass
	} from './date-range-picker.styles';
	import {
		formatTimeInput,
		parseTimeInput,
		type Meridiem,
		type TimeValue
	} from './date-range-picker.utils';

	type Props = {
		value?: TimeValue;
		onValueChange?: (value: TimeValue) => void;
		disabled?: boolean;
	};

	let {
		value = $bindable({ hour: '07', minute: '00', meridiem: 'AM' }),
		onValueChange,
		disabled = false
	}: Props = $props();

	let isEditing = $state(false);
	let editBuffer = $state('');
	let meridiemOpen = $state(false);
	let meridiemEl = $state<HTMLDivElement | null>(null);

	const displayTime = $derived(isEditing ? editBuffer : formatTimeInput(value));

	$effect(() => {
		if (disabled) {
			isEditing = false;
			meridiemOpen = false;
		}
	});

	$effect(() => {
		if (!meridiemOpen) return;

		const onPointerDown = (event: PointerEvent) => {
			if (meridiemEl?.contains(event.target as Node)) return;
			meridiemOpen = false;
		};

		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});

	function updateTime(nextInput: string, meridiem: Meridiem = value.meridiem) {
		if (disabled) return;
		const next = parseTimeInput(nextInput, meridiem);
		value = next;
		onValueChange?.(next);
	}

	function setMeridiem(meridiem: Meridiem) {
		if (disabled) return;
		updateTime(displayTime, meridiem);
		meridiemOpen = false;
	}

	function startEditing() {
		if (disabled) return;
		isEditing = true;
		editBuffer = formatTimeInput(value);
	}

	function commitEditing() {
		if (disabled) {
			isEditing = false;
			return;
		}
		updateTime(editBuffer);
		isEditing = false;
	}
</script>

<div class={dateRangePickerTimeWrapClass}>
	<div class={dateRangePickerTimeFieldClass(disabled)} aria-disabled={disabled}>
		<input
			class={dateRangePickerTimeInputClass(disabled)}
			type="text"
			inputmode="numeric"
			placeholder="07:00"
			{disabled}
			readonly={disabled}
			aria-readonly={disabled}
			value={displayTime}
			onfocus={startEditing}
			oninput={(event) => {
				if (disabled) return;
				editBuffer = event.currentTarget.value;
			}}
			onblur={commitEditing}
		/>
		<div class={dateRangePickerTimeDividerClass} aria-hidden="true"></div>
		<div class="relative" bind:this={meridiemEl}>
			<button
				type="button"
				class={dateRangePickerMeridiemButtonClass(disabled)}
				{disabled}
				aria-haspopup="listbox"
				aria-expanded={meridiemOpen}
				onclick={() => {
					if (!disabled) meridiemOpen = !meridiemOpen;
				}}
			>
				{value.meridiem}
				{#if !disabled}
					<ChevronDown class="size-3" aria-hidden="true" />
				{/if}
			</button>
			{#if meridiemOpen && !disabled}
				<ul
					role="listbox"
					class="absolute right-0 bottom-full z-10 mb-1 min-w-[4rem] border border-[#E4E4E7] bg-white py-1 shadow-md"
				>
					{#each ['AM', 'PM'] as option (option)}
						<li role="presentation">
							<button
								type="button"
								role="option"
								aria-selected={value.meridiem === option}
								class="block w-full px-3 py-1 text-left font-heading text-sm hover:bg-[#F2F2F2]"
								onclick={() => setMeridiem(option as Meridiem)}
							>
								{option}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
