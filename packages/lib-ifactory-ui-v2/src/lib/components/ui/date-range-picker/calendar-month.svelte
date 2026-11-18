<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { WEEKDAY_LABELS } from './date-range-picker.constants';
	import {
		dateRangePickerCalendarColumnClass,
		dateRangePickerDayButtonClass,
		dateRangePickerDayCellClass,
		dateRangePickerMonthHeaderClass,
		dateRangePickerMonthTitleClass,
		dateRangePickerNavButtonClass,
		dateRangePickerWeekRowClass,
		dateRangePickerWeekdayCellClass,
		dateRangePickerWeekdayRowClass
	} from './date-range-picker.styles';
	import TimePickerInput from './time-picker-input.svelte';
	import {
		buildCalendarDays,
		formatMonthYear,
		isBetweenInclusive,
		isInHoverRange,
		sameDay,
		startOfDay,
		toCalendarDate,
		type CalendarDay,
		type TimeValue
	} from './date-range-picker.utils';

	type Props = {
		viewDate: Date;
		fromDate?: Date | null;
		toDate?: Date | null;
		hoveredDate?: Date | null;
		minDate?: Date | null;
		maxDate?: Date | null;
		/** Extra disabled days (weekends, holidays). Combined with min/max. */
		isDateDisabled?: (date: Date) => boolean;
		showPrev?: boolean;
		showNext?: boolean;
		showTime?: boolean;
		/** When false, time is shown but not editable. */
		editTime?: boolean;
		timeValue?: TimeValue;
		onTimeValueChange?: (value: TimeValue) => void;
		onPrev?: () => void;
		onNext?: () => void;
		onDaySelect?: (day: CalendarDay) => void;
		onDayHover?: (day: CalendarDay | null) => void;
	};

	let {
		viewDate,
		fromDate = null,
		toDate = null,
		hoveredDate = null,
		minDate = null,
		maxDate = null,
		isDateDisabled,
		showPrev = false,
		showNext = false,
		showTime = false,
		editTime = true,
		timeValue = $bindable({ hour: '07', minute: '00', meridiem: 'AM' }),
		onTimeValueChange,
		onPrev,
		onNext,
		onDaySelect,
		onDayHover
	}: Props = $props();

	const today = startOfDay(new Date());
	const days = $derived(buildCalendarDays(viewDate.getFullYear(), viewDate.getMonth()));
	const weeks = $derived(
		Array.from({ length: 6 }, (_, weekIndex) => days.slice(weekIndex * 7, weekIndex * 7 + 7))
	);

	function isDisabledDay(day: CalendarDay): boolean {
		const date = toCalendarDate({ day: day.date, month: day.month, year: day.year });
		if (minDate && date < startOfDay(minDate)) return true;
		if (maxDate && date > startOfDay(maxDate)) return true;
		if (isDateDisabled?.(date)) return true;
		return false;
	}

	function dayDate(day: CalendarDay): Date {
		return toCalendarDate({ day: day.date, month: day.month, year: day.year });
	}

	function isSelected(date: Date): boolean {
		return Boolean((fromDate && sameDay(date, fromDate)) || (toDate && sameDay(date, toDate)));
	}

	function isDayInRange(date: Date): boolean {
		if (isSelected(date)) return false;

		return (
			isBetweenInclusive(date, fromDate, toDate) ||
			isInHoverRange(date, fromDate, hoveredDate, toDate)
		);
	}
</script>

<div class={dateRangePickerCalendarColumnClass}>
	<div class={dateRangePickerMonthHeaderClass}>
		{#if showPrev}
			<button
				type="button"
				class={dateRangePickerNavButtonClass}
				aria-label="Previous month"
				onclick={onPrev}
			>
				<ChevronLeft class="size-6" aria-hidden="true" />
			</button>
		{:else}
			<span class="size-6 shrink-0" aria-hidden="true"></span>
		{/if}

		<h2 class={dateRangePickerMonthTitleClass}>{formatMonthYear(viewDate)}</h2>

		{#if showNext}
			<button
				type="button"
				class={dateRangePickerNavButtonClass}
				aria-label="Next month"
				onclick={onNext}
			>
				<ChevronRight class="size-6" aria-hidden="true" />
			</button>
		{:else}
			<span class="size-6 shrink-0" aria-hidden="true"></span>
		{/if}
	</div>

	<div class={dateRangePickerWeekdayRowClass}>
		{#each WEEKDAY_LABELS as label (label)}
			<div class={dateRangePickerWeekdayCellClass}>{label}</div>
		{/each}
	</div>

	<div role="grid" aria-label={formatMonthYear(viewDate)}>
		{#each weeks as week, weekIndex (weekIndex)}
			<div class={dateRangePickerWeekRowClass} role="row">
				{#each week as day (`${day.year}-${day.month}-${day.date}`)}
					{@const date = dayDate(day)}
					{@const disabled = isDisabledDay(day)}
					{@const selected = day.isCurrentMonth && isSelected(date)}
					{@const inRange = day.isCurrentMonth && isDayInRange(date)}
					<div class={dateRangePickerDayCellClass} role="gridcell">
						<button
							type="button"
							class={dateRangePickerDayButtonClass({
								isCurrentMonth: day.isCurrentMonth,
								isSelected: selected,
								inRange,
								isDisabled: disabled
							})}
							{disabled}
							aria-current={sameDay(date, today) ? 'date' : undefined}
							onmouseenter={() => onDayHover?.(day)}
							onmouseleave={() => onDayHover?.(null)}
							onclick={() => onDaySelect?.(day)}
						>
							{day.date}
						</button>
					</div>
				{/each}
			</div>
		{/each}
	</div>

	{#if showTime}
		<TimePickerInput
			bind:value={timeValue}
			onValueChange={onTimeValueChange}
			disabled={!editTime}
		/>
	{/if}
</div>
