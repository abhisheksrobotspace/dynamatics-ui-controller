import type { AppDateFilter } from '$lib/appShell/appSharedState.js';
import { CNC_GROUP_ID } from './constants.js';

export type DateRange = { from: Date; to: Date; shift?: string };

/** Default dashboard/machines filter: last 7 days inclusive (v1 "latest" window). */
export function lastSevenDaysRange(): DateRange {
	const to = new Date();
	to.setHours(23, 59, 59, 999);
	const from = new Date();
	from.setDate(from.getDate() - 6);
	from.setHours(0, 0, 0, 0);
	return { from, to };
}

export function toDateRange(
	from: Date | string | number,
	to: Date | string | number,
	shift?: string
): DateRange {
	return { from: new Date(from), to: new Date(to), shift };
}

export function readSharedDateRange(filter: AppDateFilter | null | undefined): DateRange | null {
	if (filter?.controlledRange?.from == null || filter.controlledRange.to == null) return null;
	return toDateRange(
		filter.controlledRange.from,
		filter.controlledRange.to,
		typeof filter.controlledShift === 'string' ? filter.controlledShift : undefined
	);
}

export function writeSharedDateRange(filter: AppDateFilter, range: DateRange): void {
	filter.controlledRange = { from: range.from, to: range.to };
	filter.controlledShift = range.shift ?? null;
}

/** Human duration of the selected window, used in KPI "from last …" copy. */
export function formatRangeDuration(from: Date, to: Date): string {
	const ms = Math.max(0, to.getTime() - from.getTime());
	const totalMinutes = Math.floor(ms / 60_000);
	const days = Math.floor(totalMinutes / (60 * 24));
	const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
	const minutes = totalMinutes % 60;
	const parts: string[] = [];
	if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
	if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
	if (minutes > 0 && days === 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
	return parts.length > 0 ? parts.join(', ') : '0 minutes';
}

export function resolveInitialFilters(shared: AppDateFilter): {
	dateRange: DateRange;
	machineGroupId: string;
	didInitializeRange: boolean;
} {
	const existing = readSharedDateRange(shared);
	return {
		dateRange: existing ?? lastSevenDaysRange(),
		machineGroupId: String(shared.selectedMachineGroupId ?? CNC_GROUP_ID),
		didInitializeRange: existing == null
	};
}

export function previousWindow(from: Date, to: Date): { from: Date; to: Date } {
	const duration = to.getTime() - from.getTime();
	return {
		from: new Date(from.getTime() - duration),
		to: new Date(from)
	};
}
