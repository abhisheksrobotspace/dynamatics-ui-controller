<script lang="ts">
	import { CALENDAR_WEEKDAY_SHORT, type CalendarEvent } from './calendar.constants';
	import {
		calendarEventBadgeClass,
		calendarEventBlockClass,
		calendarTimeGridDayHeaderClass,
		calendarTimeGridDayNumberClass,
		calendarTimeGutterLabelClass
	} from './calendar.styles';
	import { formatHourLabel, isSameDay, layoutDayEvents, toIsoDate } from './calendar.utils';

	type Props = {
		days: Date[];
		events: CalendarEvent[];
		showDayHeaders?: boolean;
		onDaySelect?: (date: Date) => void;
		onEventClick?: (event: CalendarEvent) => void;
	};

	let { days, events, showDayHeaders = false, onDaySelect, onEventClick }: Props = $props();

	const today = new Date();
	const hours = Array.from({ length: 24 }, (_, hour) => hour);

	const layoutByDay = $derived(days.map((day) => layoutDayEvents(events, day)));

	/** Badge only when the block is tall enough (~>45 min at default hour height). */
	function showBadge(heightPct: number): boolean {
		return heightPct >= (45 / (24 * 60)) * 100;
	}
</script>

<div
	class="flex flex-auto flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
>
	{#if showDayHeaders}
		<div class="flex flex-none border-b border-border pr-2">
			<div class="w-14 flex-none" aria-hidden="true"></div>
			<div
				class="grid flex-auto"
				style:grid-template-columns={`repeat(${days.length}, minmax(0, 1fr))`}
			>
				{#each days as day (toIsoDate(day))}
					{@const isToday = isSameDay(day, today)}
					<button
						type="button"
						class={calendarTimeGridDayHeaderClass}
						onclick={() => onDaySelect?.(day)}
					>
						<span>{CALENDAR_WEEKDAY_SHORT[(day.getDay() + 6) % 7]}</span>
						<span class={calendarTimeGridDayNumberClass(isToday)}>{day.getDate()}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="flex flex-auto overflow-y-auto">
		<div class="flex w-14 flex-none flex-col border-r border-border">
			{#each hours as hour (hour)}
				<div class="h-14 flex-none">
					{#if hour > 0}
						<div class={calendarTimeGutterLabelClass}>{formatHourLabel(hour)}</div>
					{/if}
				</div>
			{/each}
		</div>
		<div
			class="grid flex-auto"
			style:grid-template-columns={`repeat(${days.length}, minmax(0, 1fr))`}
		>
			{#each days as day, dayIndex (toIsoDate(day))}
				<div class="relative border-r border-border last:border-r-0">
					{#each hours as hour (hour)}
						<div class={['h-14', hour > 0 && 'border-t border-border']}></div>
					{/each}
					{#each layoutByDay[dayIndex] as positioned (positioned.event.id)}
						{@const color = positioned.event.color ?? 'orange'}
						<button
							type="button"
							class={calendarEventBlockClass(color)}
							style:top={`${positioned.topPct}%`}
							style:height={`${positioned.heightPct}%`}
							style:left={`calc(${positioned.leftPct}% + 2px)`}
							style:width={`calc(${positioned.widthPct}% - 4px)`}
							title={positioned.event.title}
							onclick={() => onEventClick?.(positioned.event)}
						>
							{#if positioned.event.subtitle}
								<span class="truncate text-[10px] font-bold tracking-wide uppercase opacity-75">
									{positioned.event.subtitle}
								</span>
							{/if}
							{#if positioned.event.badge && showBadge(positioned.heightPct)}
								<span class={calendarEventBadgeClass(color)}>{positioned.event.badge}</span>
							{/if}
							<span class="truncate font-semibold">{positioned.event.title}</span>
							<time datetime={positioned.event.start.toISOString()} class="opacity-80">
								{positioned.timeLabel}
							</time>
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>
