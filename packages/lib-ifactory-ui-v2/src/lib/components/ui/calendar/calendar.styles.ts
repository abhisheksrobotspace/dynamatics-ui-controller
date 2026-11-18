import type { CalendarEventColor } from './calendar.constants';
import { cn } from '$lib/utils/cn';

// --- Header ---

export const calendarHeaderClass =
	'flex flex-none flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3';

export const calendarTitleClass = 'text-base font-semibold text-foreground';

export const calendarSubtitleClass = 'text-sm text-muted-foreground';

export const calendarNavGroupClass =
	'relative flex items-center rounded-none border border-border bg-surface shadow-xs';

export const calendarNavButtonClass =
	'flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus:relative';

export const calendarTodayButtonClass =
	'h-9 border-x border-border px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5 focus:relative';

// --- Month view ---

export const calendarMonthGridClass =
	'grid min-h-full grid-cols-7 grid-rows-[repeat(6,minmax(8rem,1fr))] gap-px bg-border text-sm';

export const calendarMonthWeekdayRowClass =
	'grid shrink-0 grid-cols-7 gap-px border-b border-border bg-border text-center text-xs font-semibold text-foreground';

export const calendarMonthWeekdayCellClass = 'bg-surface py-2';

/** Scroll region under the weekday header — fills height; scrolls when rows hit min size. */
export const calendarMonthScrollClass = 'min-h-0 flex-1 overflow-y-auto';

export function calendarMonthDayCellClass(inMonth: boolean): string {
	return cn(
		'relative flex min-h-0 w-full cursor-pointer flex-col gap-1 overflow-hidden px-2 py-1.5 text-left align-top transition-colors hover:bg-foreground/5',
		inMonth ? 'bg-surface' : 'bg-status-offline-bg text-muted-foreground'
	);
}

export function calendarMonthDayNumberClass(isToday: boolean): string {
	return cn(
		'flex size-6 items-center justify-center rounded-full text-xs',
		isToday
			? 'bg-primary font-semibold text-white'
			: 'text-inherit transition-colors hover:bg-foreground/5'
	);
}

export const calendarMonthMoreButtonClass =
	'text-left text-xs text-muted-foreground transition-colors hover:text-primary';

// --- Event pills (month view) ---

const eventPillColorClasses: Record<CalendarEventColor, string> = {
	orange: 'bg-primary/10 text-primary hover:bg-primary/20',
	blue: 'bg-status-loading-badge text-status-loading hover:bg-status-loading-badge/70',
	green: 'bg-status-online-badge text-status-online hover:bg-status-online-badge/70',
	red: 'bg-status-error-badge text-status-error hover:bg-status-error-badge/70',
	gray: 'bg-foreground/5 text-muted-foreground hover:bg-foreground/10'
};

export function calendarEventPillClass(color: CalendarEventColor): string {
	return cn(
		'flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-xs font-medium transition-colors',
		eventPillColorClasses[color]
	);
}

// --- Event blocks (day/week time grid) ---

const eventBlockColorClasses: Record<CalendarEventColor, string> = {
	orange: 'bg-primary/10 hover:bg-primary/20 text-primary',
	blue: 'bg-status-loading-bg hover:bg-status-loading-badge text-status-loading',
	green: 'bg-status-online-bg hover:bg-status-online-badge text-status-online',
	red: 'bg-status-error-bg hover:bg-status-error-badge text-status-error',
	gray: 'bg-status-offline-bg hover:bg-status-offline-badge text-muted-foreground'
};

export function calendarEventBlockClass(color: CalendarEventColor): string {
	return cn(
		'absolute flex flex-col overflow-hidden rounded-lg p-2 text-left text-xs leading-4 transition-colors',
		eventBlockColorClasses[color]
	);
}

const eventBadgeTextClasses: Record<CalendarEventColor, string> = {
	orange: 'text-primary',
	blue: 'text-status-loading',
	green: 'text-status-online',
	red: 'text-status-error',
	gray: 'text-muted-foreground'
};

export function calendarEventBadgeClass(color: CalendarEventColor): string {
	return cn(
		'inline-flex w-fit max-w-full truncate rounded-full bg-white/50 px-1.5 py-0.5 text-[10px] font-medium',
		eventBadgeTextClasses[color]
	);
}

// --- Time grid ---

export const calendarTimeGutterLabelClass =
	'-mt-2 pr-2 text-right text-xs leading-4 text-muted-foreground';

export const calendarTimeGridDayHeaderClass =
	'flex items-center justify-center gap-1 py-2 text-sm text-muted-foreground';

export function calendarTimeGridDayNumberClass(isToday: boolean): string {
	return cn(
		'flex items-center justify-center font-semibold',
		isToday ? 'size-8 rounded-full bg-primary text-white' : 'text-foreground'
	);
}

// --- Mini month (year view + day-view sidebar) ---

export const calendarMiniMonthClass = 'text-center';

export const calendarMiniMonthTitleClass = 'text-sm font-semibold text-foreground';

export const calendarMiniMonthWeekdayRowClass =
	'mt-4 grid grid-cols-7 text-xs leading-6 text-muted-foreground';

export const calendarMiniMonthGridClass =
	'isolate mt-2 grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border text-sm shadow-sm ring-1 ring-border';

export function calendarMiniMonthDayClass(inMonth: boolean): string {
	return cn(
		'relative min-h-10 py-1.5 focus:z-10',
		inMonth
			? 'bg-surface text-foreground hover:bg-foreground/5'
			: 'bg-status-offline-bg text-muted hover:bg-foreground/5'
	);
}

export function calendarMiniMonthDayNumberClass(isToday: boolean, isSelected: boolean): string {
	return cn(
		'flex size-7 items-center justify-center rounded-full',
		isToday && 'bg-primary font-semibold text-white',
		!isToday && isSelected && 'bg-foreground font-semibold text-white'
	);
}

export function calendarMiniMonthEventDotClass(isToday: boolean, isSelected: boolean): string {
	return cn(
		'absolute -bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full',
		isToday || isSelected ? 'bg-white' : 'bg-primary'
	);
}

// --- Year view ---

export const calendarYearGridClass =
	'mx-auto grid w-full max-w-3xl grid-cols-1 gap-x-8 gap-y-12 px-4 py-8 sm:grid-cols-2 xl:max-w-none xl:grid-cols-3 xl:px-8 2xl:grid-cols-4';
