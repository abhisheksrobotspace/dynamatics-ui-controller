<script lang="ts">
	import type { CalendarEvent } from './calendar.constants';
	import TimeGrid from './time-grid.svelte';
	import MiniMonth from './mini-month.svelte';
	import { eventsOnDay } from './calendar.utils';

	type Props = {
		date: Date;
		events: CalendarEvent[];
		onDaySelect?: (date: Date) => void;
		onEventClick?: (event: CalendarEvent) => void;
	};

	let { date, events, onDaySelect, onEventClick }: Props = $props();

	const days = $derived([date]);
</script>

<div class="flex flex-auto gap-6 overflow-hidden">
	<div class="flex min-w-0 flex-auto flex-col">
		<TimeGrid {days} {events} {onDaySelect} {onEventClick} />
	</div>
	<aside class="hidden w-64 flex-none lg:block">
		<MiniMonth
			monthDate={date}
			selectedDate={date}
			showTitle
			hasEvents={(day) => eventsOnDay(events, day).length > 0}
			{onDaySelect}
		/>
	</aside>
</div>
