export const APP_DATE_FILTER_CONTEXT = 'ifactory-app-date-filter';

/** OS window instance id for the current AppShell (focus / background-job detach). */
export const APP_INSTANCE_ID_CONTEXT = 'ifactory-app-instance-id';

/** AppDefinition.appName for the current AppShell. */
export const APP_NAME_CONTEXT = 'ifactory-app-name';

export interface AppDateFilter {
	controlledRange: { from: string | number | Date; to: string | number | Date } | null;
	controlledShift: unknown | null;
	selectedFactoryId: number | string | null;
	selectedPreset:
		'latest' | 'today' | 'yesterday' | 'previous_7_days' | 'previous_month' | 'custom';
	customDateFromIso: string | null;
	customDateTillIso: string | null;
	pendingSingleMachineTarget: unknown | null;
	datePresetMigrated: boolean;
	selectedMachineGroupId: number;
}

export function createDefaultAppDateFilter(
	selectedFactoryId: number | string | null = null
): AppDateFilter {
	return {
		controlledRange: null,
		controlledShift: null,
		selectedFactoryId,
		selectedPreset: 'latest',
		customDateFromIso: null,
		customDateTillIso: null,
		pendingSingleMachineTarget: null,
		datePresetMigrated: false,
		selectedMachineGroupId: 100
	};
}

/** One-time migration for persisted `controlledRange` before preset fields existed. */
export function migrateLegacySharedDateFilter(f: AppDateFilter | null | undefined) {
	if (!f || f.datePresetMigrated) return;
	if (
		f.controlledRange?.from != null &&
		f.controlledRange?.to != null &&
		!f.customDateFromIso &&
		!f.customDateTillIso
	) {
		f.selectedPreset = 'custom';
		f.customDateFromIso = new Date(f.controlledRange.from).toISOString();
		f.customDateTillIso = new Date(f.controlledRange.to).toISOString();
	}
	f.datePresetMigrated = true;
}

/**
 * Full page reload (F5): drop in-session date range / custom preset so UI defaults to Latest.
 * Keeps `selectedFactoryId` and `selectedMachineGroupId`.
 * @returns true if date filter fields were cleared (full reload).
 */
export function resetSharedDateFilterAfterReload(
	sharedDateFilter: AppDateFilter | null | undefined
): boolean {
	if (typeof window === 'undefined' || !sharedDateFilter) return false;
	const nav = performance.getEntriesByType?.('navigation')?.[0] as
		PerformanceNavigationTiming | undefined;
	if (!nav || nav.type !== 'reload') return false;

	sharedDateFilter.controlledRange = null;
	sharedDateFilter.controlledShift = null;
	sharedDateFilter.selectedPreset = 'latest';
	sharedDateFilter.customDateFromIso = null;
	sharedDateFilter.customDateTillIso = null;
	return true;
}
