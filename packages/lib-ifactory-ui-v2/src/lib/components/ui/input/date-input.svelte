<script lang="ts">
	import { tick } from 'svelte';
	import { Calendar } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { resolveDropdownPlacement } from '$lib/components/ui/dropdown-menu/dropdown-menu.utils';
	import CalendarMonth from '$lib/components/ui/date-range-picker/calendar-month.svelte';
	import {
		addMonths,
		startOfDay,
		toCalendarDate,
		type CalendarDay
	} from '$lib/components/ui/date-range-picker/date-range-picker.utils';
	import Input from './input.svelte';
	import { formatDdMmYyyy, parseDdMmYyyy } from './date-input.utils';
	import type { InputSize, InputVariant } from './input.styles';

	type Props = {
		value?: string;
		id?: string;
		placeholder?: string;
		disabled?: boolean;
		minDate?: Date | null;
		maxDate?: Date | null;
		/**
		 * When the field is empty, open the calendar on this month (e.g. APS schedule start)
		 * instead of the real-world current month.
		 */
		calendarMonth?: Date | null;
		/** Extra disabled days in the calendar popover (weekends, holidays). */
		isDateDisabled?: (date: Date) => boolean;
		variant?: InputVariant;
		size?: InputSize;
		error?: boolean;
		class?: string;
		/** Fired whenever the value changes (typing or calendar pick). Useful for controlled parents. */
		onValueChange?: (value: string) => void;
	};

	let {
		value = $bindable(''),
		id,
		placeholder = 'dd/mm/yyyy',
		disabled = false,
		minDate = null,
		maxDate = null,
		calendarMonth = null,
		isDateDisabled,
		variant = 'default',
		size = 'md',
		error = false,
		class: className = '',
		onValueChange
	}: Props = $props();

	let open = $state(false);
	let wrapperEl = $state<HTMLDivElement | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);
	let position = $state<{ top?: number; bottom?: number; left: number }>({ left: 0 });
	let viewDate = $state(startOfDay(new Date()));

	const selectedDate = $derived(parseDdMmYyyy(value ?? ''));

	function portal(node: HTMLElement) {
		const target = wrapperEl?.closest('dialog') || document.body;
		target.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function setOpen(next: boolean) {
		open = next;
		if (!next) return;
		if (selectedDate) {
			viewDate = startOfDay(selectedDate);
		} else if (calendarMonth && !Number.isNaN(calendarMonth.getTime())) {
			viewDate = startOfDay(calendarMonth);
		} else {
			viewDate = startOfDay(new Date());
		}
	}

	async function updatePosition() {
		await tick();
		if (!wrapperEl || !panelEl) return;

		const triggerRect = wrapperEl.getBoundingClientRect();
		const placement = resolveDropdownPlacement({
			preferredSide: 'bottom',
			preferredAlign: 'start',
			triggerRect,
			contentRect: panelEl.getBoundingClientRect(),
			gap: 4
		});

		if (placement.side === 'top') {
			position = {
				top: undefined,
				bottom: window.innerHeight - triggerRect.top + 4,
				left: placement.left
			};
			return;
		}

		position = {
			top: placement.top,
			bottom: undefined,
			left: placement.left
		};
	}

	function toggleCalendar() {
		if (disabled) return;
		setOpen(!open);
	}

	function commit(next: string) {
		value = next;
		onValueChange?.(next);
	}

	function selectDay(day: CalendarDay) {
		const date = toCalendarDate({ day: day.date, month: day.month, year: day.year });
		if (minDate && date < startOfDay(minDate)) return;
		if (maxDate && date > startOfDay(maxDate)) return;
		if (isDateDisabled?.(date)) return;
		commit(formatDdMmYyyy(date));
		setOpen(false);
	}

	$effect(() => {
		if (!open) return;

		void updatePosition();

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (panelEl?.contains(target) || wrapperEl?.contains(target)) return;
			setOpen(false);
		};

		const onReposition = () => {
			void updatePosition();
		};

		document.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('resize', onReposition);
		window.addEventListener('scroll', onReposition, true);

		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('resize', onReposition);
			window.removeEventListener('scroll', onReposition, true);
		};
	});
</script>

<div class="relative" bind:this={wrapperEl}>
	<Input
		{id}
		{value}
		{placeholder}
		{disabled}
		{variant}
		{size}
		{error}
		class={cn('pr-10', className)}
		oninput={(event) => commit(event.currentTarget.value)}
	/>
	<button
		type="button"
		class="absolute inset-y-0 right-0 flex items-center px-3 text-foreground disabled:cursor-not-allowed disabled:opacity-50"
		aria-label="Open calendar"
		onclick={toggleCalendar}
		{disabled}
	>
		<Calendar class="size-4" aria-hidden="true" />
	</button>

	{#if open}
		<div
			use:portal
			bind:this={panelEl}
			class="fixed z-[9999] bg-white p-4 shadow-lg ring-1 ring-gray-900/5"
			style:top={position.top != null ? `${position.top}px` : undefined}
			style:bottom={position.bottom != null ? `${position.bottom}px` : undefined}
			style:left={`${position.left}px`}
		>
			<CalendarMonth
				{viewDate}
				fromDate={selectedDate}
				toDate={selectedDate}
				{minDate}
				{maxDate}
				{isDateDisabled}
				showPrev
				showNext
				onPrev={() => (viewDate = addMonths(viewDate, -1))}
				onNext={() => (viewDate = addMonths(viewDate, 1))}
				onDaySelect={selectDay}
			/>
		</div>
	{/if}
</div>
