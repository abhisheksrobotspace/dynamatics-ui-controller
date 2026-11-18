import { cn } from '$lib/utils/cn';

export const dateRangePickerRootClass =
	'relative inline-flex w-full flex-row items-center gap-1 sm:w-auto';

export function dateRangePickerTriggerClass(open = false, className = ''): string {
	return cn(
		'inline-flex min-w-[16rem] items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto',
		open ? 'bg-[#C6C6C6]' : 'bg-[#F2F2F2] hover:bg-[#E8E8E8]',
		className
	);
}

export function dateRangePickerShiftTriggerClass(open = false): string {
	return cn(
		'min-w-[5rem] justify-between border border-[rgba(34,34,34,0.12)] px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors',
		open ? 'bg-[#C6C6C6]' : 'bg-[#F2F2F2] hover:bg-[#E8E8E8]'
	);
}

export const dateRangePickerPanelClass =
	'z-50 w-[624px] overflow-hidden bg-white shadow-lg ring-1 ring-gray-900/5';

export const dateRangePickerCalendarsClass = 'flex flex-row items-start gap-8 p-4';

export const dateRangePickerCalendarColumnClass = 'flex w-[280px] flex-col';

export const dateRangePickerMonthHeaderClass = 'flex h-[25px] w-full items-center justify-between';

export const dateRangePickerMonthTitleClass =
	'flex-1 text-center font-heading text-lg font-medium leading-[25px] tracking-[0.005em] text-[#1F2937]';

export const dateRangePickerWeekdayRowClass = 'flex w-full pt-4 pb-2';

export const dateRangePickerWeekdayCellClass =
	'flex h-5 w-10 items-start justify-center font-heading text-sm font-medium leading-5 tracking-[0.005em] text-[#6B7280]';

export const dateRangePickerWeekRowClass = 'flex w-full';

export const dateRangePickerDayCellClass = 'flex size-10 items-center justify-center p-0';

export function dateRangePickerDayButtonClass({
	isCurrentMonth,
	isSelected,
	inRange,
	isDisabled
}: {
	isCurrentMonth: boolean;
	isSelected: boolean;
	inRange: boolean;
	isDisabled: boolean;
}): string {
	return cn(
		'flex size-10 items-center justify-center border-0 bg-transparent p-0 font-heading text-sm font-medium leading-5 tracking-[0.005em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
		isSelected && 'bg-[#232323] text-white',
		!isSelected && inRange && 'bg-[#F2F2F2] text-[#1F2937]',
		!isSelected && !inRange && isCurrentMonth && !isDisabled && 'text-[#1F2937] hover:bg-black/5',
		!isSelected && !inRange && !isCurrentMonth && 'text-[#D1D5DB]',
		isDisabled && 'cursor-not-allowed text-[#D1D5DB] hover:bg-transparent'
	);
}

export const dateRangePickerTimeWrapClass = 'flex w-full items-center gap-2 pt-4';

export function dateRangePickerTimeFieldClass(disabled = false): string {
	return cn(
		'box-border flex h-7 w-full items-center gap-2 border py-1 pl-3 pr-1',
		disabled
			? 'cursor-not-allowed border-[#E4E4E7] bg-[#F2F2F2] text-[#9CA3AF]'
			: 'border-[#E4E4E7] bg-white'
	);
}

export function dateRangePickerTimeInputClass(disabled = false): string {
	return cn(
		'min-w-0 flex-1 border-0 bg-transparent font-heading text-sm font-medium leading-5 tracking-[0.005em] outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
		disabled ? 'cursor-not-allowed text-[#9CA3AF]' : 'text-[#1F2937]'
	);
}

export const dateRangePickerTimeDividerClass = 'h-5 w-px shrink-0 bg-[#E4E4E7]';

export function dateRangePickerMeridiemButtonClass(disabled = false): string {
	return cn(
		'inline-flex shrink-0 items-center gap-1 border-0 bg-transparent px-1 font-heading text-sm font-medium leading-5 tracking-[0.005em] outline-none focus:outline-none focus-visible:outline-none',
		disabled ? 'cursor-not-allowed text-[#9CA3AF]' : 'text-[#1F2937]'
	);
}

export const dateRangePickerFooterClass =
	'flex h-10 w-full items-stretch justify-end border-t border-[#E4E4E7] bg-white';

export const dateRangePickerCancelButtonClass =
	'inline-flex h-10 w-[110px] shrink-0 items-center justify-center border border-[rgba(34,34,34,0.12)] bg-[#F2F2F2] font-body text-sm font-medium leading-5 text-[#666666]';

export const dateRangePickerApplyButtonClass =
	'inline-flex h-10 w-[104px] shrink-0 items-center justify-center bg-primary font-body text-sm font-bold leading-[18px] tracking-[0.16px] text-white';

export const dateRangePickerNavButtonClass =
	'inline-flex size-6 items-center justify-center border-0 bg-transparent p-0 text-[#1F2937] transition-colors hover:opacity-70';
