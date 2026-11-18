<script lang="ts">
	import { Combobox, DateRangePicker } from '@ifactory/ui-v2';
	import type { DateRange } from '../lib/date-range.js';
	import type { MachineGroupOption, Shift } from '../lib/types.js';

	type Props = {
		machineGroupItems?: MachineGroupOption[];
		machineGroupId?: string;
		dateRange: DateRange | null;
		shifts: Shift[];
		disabled?: boolean;
		showMachineGroup?: boolean;
		/** Compact flush controls for MenuBar (Figma menubar strip). */
		variant?: 'default' | 'menubar';
		onMachineGroupChange?: (value: string) => void;
		onDateRangeChange: (value: DateRange) => void;
	};

	let {
		machineGroupItems = [],
		machineGroupId = '0',
		dateRange = $bindable(null),
		shifts,
		disabled = false,
		showMachineGroup = true,
		variant = 'default',
		onMachineGroupChange,
		onDateRangeChange
	}: Props = $props();

	const shiftConfigs = $derived(
		shifts.map((shift) => ({
			name: shift.name,
			start: shift.start_time.slice(0, 5),
			end: shift.end_time.slice(0, 5)
		}))
	);

	const isMenubar = $derived(variant === 'menubar');
</script>

<div
	class={[
		'flex min-w-0',
		isMenubar
			? 'h-full items-stretch'
			: 'w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end'
	]}
>
	{#if showMachineGroup}
		<div
			class={[
				'min-w-0',
				isMenubar ? 'shrink-0 self-stretch sm:w-44' : 'w-full sm:w-50 sm:shrink-0'
			]}
		>
			<Combobox
				items={machineGroupItems}
				value={machineGroupId}
				onValueChange={(value) => onMachineGroupChange?.(String(value))}
				placeholder="All Machines"
				{disabled}
				triggerClass={isMenubar
					? 'h-full min-h-9 w-full min-w-0 rounded-none border-0 border-l border-[rgba(34,34,34,0.12)] bg-[#f2f2f2]'
					: undefined}
			/>
		</div>
	{/if}
	<div class={['min-w-0', isMenubar ? 'shrink-0 self-stretch' : 'w-full sm:w-auto sm:shrink-0']}>
		<DateRangePicker
			bind:value={dateRange}
			onValueChange={onDateRangeChange}
			showTime={false}
			showShiftSelector={shiftConfigs.length > 0}
			shifts={shiftConfigs}
			{disabled}
			class={isMenubar ? 'h-full' : 'w-full'}
			triggerClass={isMenubar
				? 'h-full min-h-9 w-full min-w-0 rounded-none border-0 border-l border-[rgba(34,34,34,0.12)] bg-[#f2f2f2] sm:w-auto'
				: 'w-full min-w-0 sm:w-auto'}
		/>
	</div>
</div>
