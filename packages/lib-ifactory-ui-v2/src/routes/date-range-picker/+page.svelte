<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { DateRangePicker, type DateRangePresetId, type DateRangeSelection } from '$lib';

	let range = $state<DateRangeSelection | null>(null);
	let dateOnlyRange = $state<DateRangeSelection | null>(null);
	let shiftRightRange = $state<DateRangeSelection | null>(null);
	let presetRange = $state<DateRangeSelection | null>(null);
	let preset = $state<DateRangePresetId>('today');

	const shifts = [
		{ name: 'Shift 1', start: '06:00', end: '14:00' },
		{ name: 'Shift 2', start: '14:00', end: '22:00' },
		{ name: 'Shift 3', start: '22:00', end: '06:00' }
	];

	function formatRange(value: DateRangeSelection | null): string {
		if (!value) return '(empty)';
		return `${value.from.toLocaleString()} → ${value.to.toLocaleString()}`;
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Date Range Picker</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Dual-calendar range picker with optional time selection, matching the iFactory date range UX.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Standard</h2>
		<p class="text-sm text-muted-foreground">
			Default two-shift configuration with date and time selection.
		</p>
		<DateRangePicker
			bind:value={range}
			{shifts}
			showShiftSelector
			onValueChange={(next) => (range = next)}
		/>
		<p class="text-sm text-muted-foreground">Selected: {formatRange(range)}</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Date only</h2>
		<p class="text-sm text-muted-foreground">
			Hides the time row and formats the trigger label with dates only.
		</p>
		<DateRangePicker bind:value={dateOnlyRange} showTime={false} />
		<p class="text-sm text-muted-foreground">Selected: {formatRange(dateOnlyRange)}</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Shift selector on the right</h2>
		<p class="text-sm text-muted-foreground">
			Shift dropdown positioned to the right of the date picker trigger.
		</p>
		<DateRangePicker
			bind:value={shiftRightRange}
			{shifts}
			showShiftSelector
			shiftPosition="right"
			onValueChange={(next) => (shiftRightRange = next)}
		/>
		<p class="text-sm text-muted-foreground">Selected: {formatRange(shiftRightRange)}</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Presets + maxRangeDays</h2>
		<p class="text-sm text-muted-foreground">
			Preset dropdown (Today / Last day / Last week / Last month / Custom). Calendar is disabled
			unless Custom is selected. Custom ranges are capped at 7 days.
		</p>
		<DateRangePicker
			bind:value={presetRange}
			bind:preset
			{shifts}
			showPresetSelector
			showShiftSelector
			showTime
			maxRangeDays={7}
			onValueChange={(next) => (presetRange = next)}
			onPresetChange={(next) => (preset = next)}
		/>
		<p class="text-sm text-muted-foreground">
			Preset: {preset} — Selected: {formatRange(presetRange)}
		</p>
	</section>
</div>
