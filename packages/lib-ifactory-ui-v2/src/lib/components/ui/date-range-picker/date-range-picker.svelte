<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Calendar } from '@lucide/svelte';
	import { DropdownMenu } from '$lib/components/ui/dropdown-menu';
	import { resolveDropdownPlacement } from '$lib/components/ui/dropdown-menu/dropdown-menu.utils';
	import { cn } from '$lib/utils/cn';
	import CalendarMonth from './calendar-month.svelte';
	import { DEFAULT_SHIFTS } from './date-range-picker.constants';
	import {
		dateRangePickerApplyButtonClass,
		dateRangePickerCalendarsClass,
		dateRangePickerCancelButtonClass,
		dateRangePickerFooterClass,
		dateRangePickerPanelClass,
		dateRangePickerRootClass,
		dateRangePickerShiftTriggerClass,
		dateRangePickerTriggerClass
	} from './date-range-picker.styles';
	import {
		addMonths,
		buildRangeFromSelection,
		DATE_RANGE_PRESET_OPTIONS,
		formatTriggerLabel,
		getActiveShiftRange,
		getAllShiftsRange,
		getPresetRange,
		getRangeForShiftName,
		isOutsideMaxRangeFromAnchor,
		isWithinMaxRangeDays,
		normalizeRangeOrder,
		selectionFromRange,
		startOfDay,
		toCalendarDate,
		type CalendarDay,
		type DateRangePresetId,
		type DateRangeSelection,
		type ShiftConfig,
		type TimeValue
	} from './date-range-picker.utils';

	type Props = {
		value?: DateRangeSelection | null;
		onValueChange?: (value: DateRangeSelection) => void;
		onShiftChange?: (shift: string) => void;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		disabled?: boolean;
		showTime?: boolean;
		/** When false with showTime, times appear in the label/panel but cannot be edited. */
		editTime?: boolean;
		showShiftSelector?: boolean;
		showPresetSelector?: boolean;
		preset?: DateRangePresetId;
		onPresetChange?: (preset: DateRangePresetId) => void;
		maxRangeDays?: number | null;
		shiftPosition?: 'left' | 'right';
		shifts?: ShiftConfig[];
		minDate?: Date | null;
		maxDate?: Date | null;
		cancelLabel?: string;
		applyLabel?: string;
		class?: string;
		triggerClass?: string;
	};

	let {
		value = $bindable(null),
		onValueChange,
		onShiftChange,
		open = $bindable(false),
		onOpenChange,
		disabled = false,
		showTime = true,
		editTime = true,
		showShiftSelector = false,
		showPresetSelector = false,
		preset = $bindable<DateRangePresetId>('today'),
		onPresetChange,
		maxRangeDays = null,
		shiftPosition = 'left',
		shifts,
		minDate = null,
		maxDate = new Date(),
		cancelLabel = 'Cancel',
		applyLabel = 'Apply',
		class: className = '',
		triggerClass = ''
	}: Props = $props();

	let triggerEl = $state<HTMLButtonElement | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);
	let position = $state({ top: 0, left: 0 });

	let viewDate = $state(startOfDay(new Date()));
	let draftFromDate = $state<Date | null>(null);
	let draftToDate = $state<Date | null>(null);
	let draftFromTime = $state<TimeValue>({ hour: '07', minute: '00', meridiem: 'AM' });
	let draftToTime = $state<TimeValue>({ hour: '07', minute: '00', meridiem: 'PM' });
	let hoveredDate = $state<Date | null>(null);
	let selectedShift = $state('All Shifts');
	let lastSyncedValueKey = $state('');
	let shiftMenuOpen = $state(false);
	let presetMenuOpen = $state(false);

	const resolvedShifts = $derived(shifts?.length ? shifts : [...DEFAULT_SHIFTS]);

	const rightViewDate = $derived(addMonths(viewDate, 1));

	const calendarLocked = $derived(showPresetSelector && preset !== 'custom');
	const dateTriggerDisabled = $derived(disabled || calendarLocked);

	const triggerLabel = $derived(
		value ? formatTriggerLabel(value.from, value.to, showTime) : 'Select date range'
	);

	const presetLabel = $derived(
		DATE_RANGE_PRESET_OPTIONS.find((option) => option.id === preset)?.label ?? 'Today'
	);

	const presetOptions = $derived(
		DATE_RANGE_PRESET_OPTIONS.map((option) => ({
			label: option.label,
			value: option.id,
			onclick: () => selectPreset(option.id)
		}))
	);

	const shiftOptions = $derived([
		...resolvedShifts.map((shift) => ({
			label: shift.name,
			value: shift.name,
			onclick: () => selectShift(shift.name)
		})),
		{
			label: 'All Shifts',
			value: 'All Shifts',
			onclick: () => selectShift('All Shifts')
		}
	]);

	function portal(node: HTMLElement) {
		// Native showModal() dialogs use the top layer; body-level portals sit behind them.
		const target = triggerEl?.closest('dialog') || document.body;
		target.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function syncDraftFromValue(nextValue: DateRangeSelection | null) {
		if (!nextValue) return;
		const selection = selectionFromRange(nextValue);
		draftFromDate = startOfDay(selection.fromDate!);
		draftToDate = startOfDay(selection.toDate!);
		draftFromTime = selection.fromTime;
		draftToTime = selection.toTime;
		selectedShift = nextValue.shift ?? selectedShift;
		viewDate = startOfDay(selection.fromDate!);
	}

	function applyRange(range: DateRangeSelection) {
		value = range;
		selectedShift = range.shift ?? selectedShift;
		syncDraftFromValue(range);
		onValueChange?.(range);
		if (range.shift) {
			onShiftChange?.(range.shift);
		}
	}

	function initializeDefaultRange() {
		if (showPresetSelector) {
			const nextPreset = preset === 'custom' ? 'today' : preset;
			preset = nextPreset;
			onPresetChange?.(nextPreset);
			applyRange(getPresetRange(nextPreset, resolvedShifts));
			return;
		}

		applyRange(getActiveShiftRange(resolvedShifts));
	}

	function selectPreset(next: DateRangePresetId) {
		preset = next;
		onPresetChange?.(next);

		if (next === 'custom') {
			return;
		}

		applyRange(getPresetRange(next, resolvedShifts));
		setOpen(false);
	}

	function selectShift(shiftName: string) {
		if (shiftName === 'All Shifts') {
			// Same window as the Last day preset (last completed production day).
			if (showPresetSelector) {
				preset = 'last_day';
				onPresetChange?.('last_day');
				applyRange(getPresetRange('last_day', resolvedShifts));
				return;
			}
			applyRange(getAllShiftsRange(resolvedShifts));
			return;
		}
		// Named shifts → current or most recent completed instance (future shifts → yesterday).
		applyRange(getRangeForShiftName(resolvedShifts, shiftName));
	}

	function isDateDisabledForMaxRange(date: Date): boolean {
		if (maxRangeDays == null || maxRangeDays <= 0) return false;
		if (draftFromDate && !draftToDate) {
			return isOutsideMaxRangeFromAnchor(date, draftFromDate, maxRangeDays);
		}
		return false;
	}

	function handleDaySelect(day: CalendarDay) {
		const selected = toCalendarDate({ day: day.date, month: day.month, year: day.year });

		if (draftFromDate && draftToDate) {
			draftFromDate = selected;
			draftToDate = null;
			return;
		}

		if (draftFromDate && !draftToDate) {
			const ordered = normalizeRangeOrder(draftFromDate, selected);
			draftFromDate = ordered.fromDate;
			draftToDate = ordered.toDate;
			return;
		}

		draftFromDate = selected;
	}

	function handleDayHover(day: CalendarDay | null) {
		hoveredDate = day ? toCalendarDate({ day: day.date, month: day.month, year: day.year }) : null;
	}

	function revertDraft() {
		syncDraftFromValue(value);
		hoveredDate = null;
	}

	function handleCancel() {
		revertDraft();
		setOpen(false);
	}

	function handleApply() {
		if (!draftFromDate || !draftToDate) {
			window.alert('Please select both the start and end dates.');
			return;
		}

		const range = buildRangeFromSelection({
			fromDate: draftFromDate,
			toDate: draftToDate,
			fromTime: draftFromTime,
			toTime: draftToTime,
			shift: selectedShift
		});

		if (range.from.getTime() === range.to.getTime()) {
			window.alert('The start date & time and end date & time cannot be the same.');
			return;
		}

		if (range.from > range.to) {
			window.alert('The start date & time must be before the end date & time.');
			return;
		}

		if (maxDate && range.from > maxDate) {
			window.alert('The start time cannot be greater than the current time.');
			return;
		}

		if (!isWithinMaxRangeDays(range.from, range.to, maxRangeDays)) {
			window.alert(`Please select a range of at most ${maxRangeDays} days.`);
			return;
		}

		value = range;
		onValueChange?.(range);
		setOpen(false);
	}

	async function updatePosition() {
		await tick();
		if (!triggerEl || !panelEl) return;

		const placement = resolveDropdownPlacement({
			preferredSide: 'bottom',
			preferredAlign: 'start',
			triggerRect: triggerEl.getBoundingClientRect(),
			contentRect: panelEl.getBoundingClientRect(),
			gap: 8
		});

		position = { top: placement.top, left: placement.left };
	}

	function toggleOpen() {
		if (dateTriggerDisabled) return;
		if (!open) {
			revertDraft();
		}
		setOpen(!open);
	}

	function isPickerChrome(target: Element | null): boolean {
		return Boolean(
			target?.closest?.(
				'.date-range-picker-shift, .date-range-picker-shift-menu, .date-range-picker-preset, .date-range-picker-preset-menu'
			)
		);
	}

	onMount(() => {
		if (!value) {
			initializeDefaultRange();
		}
	});

	$effect(() => {
		if (!value || open) return;

		const nextKey = `${value.from.toISOString()}|${value.to.toISOString()}|${value.shift ?? ''}`;
		if (nextKey === lastSyncedValueKey) return;

		lastSyncedValueKey = nextKey;
		syncDraftFromValue(value);
	});

	$effect(() => {
		if (!open) return;

		void updatePosition();

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (panelEl?.contains(target)) return;
			if (triggerEl?.contains(target)) return;
			if (isPickerChrome(target as Element)) return;
			revertDraft();
			setOpen(false);
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				revertDraft();
				setOpen(false);
				triggerEl?.focus();
			}
		};

		const onReposition = () => {
			void updatePosition();
		};

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		window.addEventListener('resize', onReposition);
		window.addEventListener('scroll', onReposition, true);

		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', onReposition);
			window.removeEventListener('scroll', onReposition, true);
		};
	});
</script>

<div class={cn(dateRangePickerRootClass, className)}>
	{#if showPresetSelector}
		<DropdownMenu
			bind:open={presetMenuOpen}
			triggerLabel={presetLabel}
			selectedValue={preset}
			showChevron
			side="bottom"
			align="start"
			{disabled}
			class="date-range-picker-preset"
			contentClass="date-range-picker-preset-menu"
			triggerClass={dateRangePickerShiftTriggerClass(presetMenuOpen)}
			groups={[presetOptions]}
		/>
	{/if}

	{#if showShiftSelector && shiftPosition === 'left'}
		<DropdownMenu
			bind:open={shiftMenuOpen}
			triggerLabel={selectedShift}
			selectedValue={selectedShift}
			showChevron
			side="bottom"
			align="start"
			{disabled}
			class="date-range-picker-shift"
			contentClass="date-range-picker-shift-menu"
			triggerClass={dateRangePickerShiftTriggerClass(shiftMenuOpen)}
			groups={[shiftOptions]}
		/>
	{/if}

	<button
		type="button"
		bind:this={triggerEl}
		class={dateRangePickerTriggerClass(open, triggerClass)}
		aria-haspopup="dialog"
		aria-expanded={open}
		disabled={dateTriggerDisabled}
		onclick={toggleOpen}
	>
		<Calendar class="size-4 shrink-0 text-foreground" aria-hidden="true" />
		<span class="truncate">{triggerLabel}</span>
	</button>

	{#if showShiftSelector && shiftPosition === 'right'}
		<DropdownMenu
			bind:open={shiftMenuOpen}
			triggerLabel={selectedShift}
			selectedValue={selectedShift}
			showChevron
			side="bottom"
			align="start"
			{disabled}
			class="date-range-picker-shift"
			contentClass="date-range-picker-shift-menu"
			triggerClass={dateRangePickerShiftTriggerClass(shiftMenuOpen)}
			groups={[shiftOptions]}
		/>
	{/if}

	{#if open}
		<div
			use:portal
			bind:this={panelEl}
			role="dialog"
			aria-label="Date range picker"
			class={dateRangePickerPanelClass}
			style:top="{position.top}px"
			style:left="{position.left}px"
			style:position="fixed"
		>
			<div class={dateRangePickerCalendarsClass}>
				<CalendarMonth
					{viewDate}
					fromDate={draftFromDate}
					toDate={draftToDate}
					{hoveredDate}
					{minDate}
					{maxDate}
					isDateDisabled={isDateDisabledForMaxRange}
					{showTime}
					{editTime}
					bind:timeValue={draftFromTime}
					showPrev
					onPrev={() => {
						viewDate = addMonths(viewDate, -1);
					}}
					onDaySelect={handleDaySelect}
					onDayHover={handleDayHover}
				/>
				<CalendarMonth
					viewDate={rightViewDate}
					fromDate={draftFromDate}
					toDate={draftToDate}
					{hoveredDate}
					{minDate}
					{maxDate}
					isDateDisabled={isDateDisabledForMaxRange}
					{showTime}
					{editTime}
					bind:timeValue={draftToTime}
					showNext
					onNext={() => {
						viewDate = addMonths(viewDate, 1);
					}}
					onDaySelect={handleDaySelect}
					onDayHover={handleDayHover}
				/>
			</div>

			<div class={dateRangePickerFooterClass}>
				<button type="button" class={dateRangePickerCancelButtonClass} onclick={handleCancel}>
					{cancelLabel}
				</button>
				<button type="button" class={dateRangePickerApplyButtonClass} onclick={handleApply}>
					{applyLabel}
				</button>
			</div>
		</div>
	{/if}
</div>
