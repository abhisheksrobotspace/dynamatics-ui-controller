<script lang="ts">
	import type { CalendarEvent } from './calendar.constants';
	import MiniMonth from './mini-month.svelte';
	import { calendarYearGridClass } from './calendar.styles';
	import { daysWithEvents, toIsoDate } from './calendar.utils';

	type Props = {
		date: Date;
		events: CalendarEvent[];
		onDaySelect?: (date: Date) => void;
	};

	let { date, events, onDaySelect }: Props = $props();

	const months = $derived(
		Array.from({ length: 12 }, (_, month) => new Date(date.getFullYear(), month, 1))
	);
	const eventDayKeys = $derived(daysWithEvents(events));
</script>

<div class="flex-auto overflow-y-auto bg-surface">
	<div class={calendarYearGridClass}>
		{#each months as monthDate (monthDate.getMonth())}
			<MiniMonth
				{monthDate}
				showTitle
				hasEvents={(day) => eventDayKeys.has(toIsoDate(day))}
				{onDaySelect}
			/>
		{/each}
	</div>
</div>
