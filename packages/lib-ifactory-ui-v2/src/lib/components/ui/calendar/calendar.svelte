<script lang="ts">
	import { ChevronLeft, ChevronRight, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { DropdownMenu } from '$lib/components/ui/dropdown-menu';
	import { cn } from '$lib/utils/cn';
	import {
		CALENDAR_VIEWS,
		CALENDAR_VIEW_LABELS,
		type CalendarEvent,
		type CalendarView
	} from './calendar.constants';
	import {
		calendarHeaderClass,
		calendarNavButtonClass,
		calendarNavGroupClass,
		calendarSubtitleClass,
		calendarTitleClass,
		calendarTodayButtonClass
	} from './calendar.styles';
	import {
		formatCalendarSubtitle,
		formatCalendarTitle,
		getWeekDays,
		navigateDate,
		startOfDay,
		toIsoDate
	} from './calendar.utils';
	import MonthView from './month-view.svelte';
	import TimeGrid from './time-grid.svelte';
	import DayView from './day-view.svelte';
	import YearView from './year-view.svelte';

	type Props = {
		view?: CalendarView;
		date?: Date;
		events?: CalendarEvent[];
		/** Which views the switcher offers; single entry hides the switcher. */
		views?: CalendarView[];
		addEventLabel?: string;
		/** Renders the add button only when provided. */
		onAddEvent?: () => void;
		onEventClick?: (event: CalendarEvent) => void;
		/** Fires when a day cell / mini-month day is picked. */
		onDaySelect?: (date: Date) => void;
		onDateChange?: (date: Date) => void;
		onViewChange?: (view: CalendarView) => void;
		class?: string;
	};

	let {
		view = $bindable('month'),
		date = $bindable(startOfDay(new Date())),
		events = [],
		views = [...CALENDAR_VIEWS],
		addEventLabel = 'Add event',
		onAddEvent,
		onEventClick,
		onDaySelect,
		onDateChange,
		onViewChange,
		class: className = ''
	}: Props = $props();

	const title = $derived(formatCalendarTitle(date, view));
	const subtitle = $derived(formatCalendarSubtitle(date, view));
	const weekDays = $derived(getWeekDays(date));

	const viewMenuGroups = $derived([
		views.map((option) => ({
			label: CALENDAR_VIEW_LABELS[option],
			value: option,
			onclick: () => setView(option)
		}))
	]);

	function setDate(next: Date) {
		date = next;
		onDateChange?.(next);
	}

	function setView(next: CalendarView) {
		if (view === next) return;
		view = next;
		onViewChange?.(next);
	}

	function navigate(direction: 1 | -1) {
		setDate(navigateDate(date, view, direction));
	}

	function goToToday() {
		setDate(startOfDay(new Date()));
	}

	/** Day picked from month/year/week: focus it and drill into the day view. */
	function selectDay(selected: Date) {
		setDate(startOfDay(selected));
		if ((view === 'month' || view === 'year' || view === 'week') && views.includes('day')) {
			setView('day');
		}
		onDaySelect?.(selected);
	}
</script>

<div class={cn('flex h-full min-h-0 flex-col', className)}>
	<header class={calendarHeaderClass}>
		<div class="flex items-baseline gap-2">
			<h1 class={calendarTitleClass}>
				<time datetime={toIsoDate(date)}>{title}</time>
			</h1>
			{#if subtitle}
				<p class={calendarSubtitleClass}>{subtitle}</p>
			{/if}
		</div>
		<div class="flex items-center gap-4">
			<div class={calendarNavGroupClass}>
				<button
					type="button"
					class={calendarNavButtonClass}
					aria-label={`Previous ${view}`}
					onclick={() => navigate(-1)}
				>
					<ChevronLeft class="size-5" aria-hidden="true" />
				</button>
				<button type="button" class={calendarTodayButtonClass} onclick={goToToday}> Today </button>
				<button
					type="button"
					class={calendarNavButtonClass}
					aria-label={`Next ${view}`}
					onclick={() => navigate(1)}
				>
					<ChevronRight class="size-5" aria-hidden="true" />
				</button>
			</div>
			{#if views.length > 1}
				<DropdownMenu
					side="bottom"
					align="end"
					groups={viewMenuGroups}
					selectedValue={view}
					triggerLabel={CALENDAR_VIEW_LABELS[view]}
					showChevron
					matchTriggerWidth={false}
					triggerClass="rounded-none"
					triggerAriaLabel="Change calendar view"
				/>
			{/if}
			{#if onAddEvent}
				<Button class="rounded-none" label={addEventLabel} icon={Plus} onclick={onAddEvent} />
			{/if}
		</div>
	</header>

	<div class="flex min-h-0 flex-1 flex-col p-4">
		{#if view === 'month'}
			<MonthView {date} {events} onDaySelect={selectDay} {onEventClick} />
		{:else if view === 'week'}
			<TimeGrid days={weekDays} {events} showDayHeaders onDaySelect={selectDay} {onEventClick} />
		{:else if view === 'day'}
			<DayView {date} {events} onDaySelect={selectDay} {onEventClick} />
		{:else}
			<YearView {date} {events} onDaySelect={selectDay} />
		{/if}
	</div>
</div>
