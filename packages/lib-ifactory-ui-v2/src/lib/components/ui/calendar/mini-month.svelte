<script lang="ts">
	import { CALENDAR_WEEKDAY_INITIALS } from './calendar.constants';
	import {
		calendarMiniMonthClass,
		calendarMiniMonthDayClass,
		calendarMiniMonthDayNumberClass,
		calendarMiniMonthEventDotClass,
		calendarMiniMonthGridClass,
		calendarMiniMonthTitleClass,
		calendarMiniMonthWeekdayRowClass
	} from './calendar.styles';
	import { buildMonthGrid, formatMonthName, isSameDay, toIsoDate } from './calendar.utils';

	type Props = {
		/** Any date inside the month to render. */
		monthDate: Date;
		selectedDate?: Date | null;
		/** Marks days that have events with a dot. */
		hasEvents?: (date: Date) => boolean;
		showTitle?: boolean;
		onDaySelect?: (date: Date) => void;
	};

	let {
		monthDate,
		selectedDate = null,
		hasEvents,
		showTitle = true,
		onDaySelect
	}: Props = $props();

	const today = new Date();
	const days = $derived(buildMonthGrid(monthDate));
</script>

<section class={calendarMiniMonthClass}>
	{#if showTitle}
		<h2 class={calendarMiniMonthTitleClass}>{formatMonthName(monthDate)}</h2>
	{/if}
	<div class={calendarMiniMonthWeekdayRowClass}>
		{#each CALENDAR_WEEKDAY_INITIALS as initial, index (index)}
			<div>{initial}</div>
		{/each}
	</div>
	<div class={calendarMiniMonthGridClass}>
		{#each days as day (toIsoDate(day.date))}
			{@const isToday = isSameDay(day.date, today)}
			{@const isSelected = selectedDate != null && isSameDay(day.date, selectedDate)}
			{@const showDot = hasEvents?.(day.date) ?? false}
			<button
				type="button"
				class={calendarMiniMonthDayClass(day.inMonth)}
				onclick={() => onDaySelect?.(day.date)}
			>
				<div class="relative mx-auto flex size-7 items-center justify-center">
					<time
						datetime={toIsoDate(day.date)}
						class={calendarMiniMonthDayNumberClass(isToday, isSelected)}
					>
						{day.date.getDate()}
					</time>
					{#if showDot}
						<span class={calendarMiniMonthEventDotClass(isToday, isSelected)} aria-hidden="true"
						></span>
					{/if}
				</div>
			</button>
		{/each}
	</div>
</section>
