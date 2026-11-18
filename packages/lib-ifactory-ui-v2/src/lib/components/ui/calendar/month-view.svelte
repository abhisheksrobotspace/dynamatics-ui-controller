<script lang="ts">
	import {
		CALENDAR_MONTH_MAX_EVENTS,
		CALENDAR_WEEKDAY_SHORT,
		type CalendarEvent
	} from './calendar.constants';
	import {
		calendarEventPillClass,
		calendarMonthDayCellClass,
		calendarMonthDayNumberClass,
		calendarMonthGridClass,
		calendarMonthMoreButtonClass,
		calendarMonthScrollClass,
		calendarMonthWeekdayCellClass,
		calendarMonthWeekdayRowClass
	} from './calendar.styles';
	import {
		buildMonthGrid,
		eventsOnDay,
		formatEventTime,
		isSameDay,
		toIsoDate
	} from './calendar.utils';

	type Props = {
		date: Date;
		events: CalendarEvent[];
		onDaySelect?: (date: Date) => void;
		onEventClick?: (event: CalendarEvent) => void;
	};

	let { date, events, onDaySelect, onEventClick }: Props = $props();

	const today = new Date();
	const days = $derived(buildMonthGrid(date));

	function handleEventClick(event: CalendarEvent, e: MouseEvent) {
		e.stopPropagation();
		onEventClick?.(event);
	}
</script>

<div
	class="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-border shadow-sm"
>
	<div class={calendarMonthWeekdayRowClass}>
		{#each CALENDAR_WEEKDAY_SHORT as label (label)}
			<div class={calendarMonthWeekdayCellClass}>{label}</div>
		{/each}
	</div>
	<div class={calendarMonthScrollClass}>
		<div class={calendarMonthGridClass}>
			{#each days as day (toIsoDate(day.date))}
				{@const dayEvents = eventsOnDay(events, day.date)}
				{@const visibleEvents = dayEvents.slice(0, CALENDAR_MONTH_MAX_EVENTS)}
				{@const hiddenCount = dayEvents.length - visibleEvents.length}
				<div
					role="button"
					tabindex="0"
					class={calendarMonthDayCellClass(day.inMonth)}
					aria-label={day.date.toDateString()}
					onclick={() => onDaySelect?.(day.date)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onDaySelect?.(day.date);
						}
					}}
				>
					<span class={calendarMonthDayNumberClass(isSameDay(day.date, today))}>
						<time datetime={toIsoDate(day.date)}>{day.date.getDate()}</time>
					</span>
					{#if visibleEvents.length > 0}
						<ol class="flex min-h-0 w-full flex-col gap-1 overflow-hidden">
							{#each visibleEvents as event (event.id)}
								<li class="min-h-0 shrink">
									<button
										type="button"
										class={calendarEventPillClass(event.color ?? 'orange')}
										title={event.subtitle ? `${event.title} - ${event.subtitle}` : event.title}
										onclick={(e) => handleEventClick(event, e)}
									>
										<span class="flex min-w-0 flex-auto flex-col truncate text-left">
											<span class="truncate">{event.title}</span>
											{#if event.subtitle}
												<span class="truncate text-[10px] font-normal opacity-80"
													>{event.subtitle}</span
												>
											{/if}
										</span>
										<time
											datetime={event.start.toISOString()}
											class="hidden flex-none opacity-80 xl:block"
										>
											{formatEventTime(event.start)}
										</time>
									</button>
								</li>
							{/each}
						</ol>
					{/if}
					{#if hiddenCount > 0}
						<span class={calendarMonthMoreButtonClass}>+ {hiddenCount} more</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>
