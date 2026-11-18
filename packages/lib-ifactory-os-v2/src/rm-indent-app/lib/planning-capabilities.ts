/** Capability flags for Central Planning / Shop Floor Planning shells. */

export type PlanningCapabilities = {
	canRaiseIndent: boolean;
	/** Lock, Unlock All, Confirm & Lock dialogs. */
	canLock: boolean;
	canReplan: boolean;
};

export type PlanningAppData = {
	appName: string;
	capabilities: PlanningCapabilities;
};

export const CENTRAL_PLANNING_CAPABILITIES: PlanningCapabilities = {
	canRaiseIndent: false,
	canLock: false,
	canReplan: false
};

export const SHOP_FLOOR_PLANNING_CAPABILITIES: PlanningCapabilities = {
	canRaiseIndent: false,
	canLock: true,
	canReplan: true
};

/** Full capabilities — used when a screen is opened under RMI without planning data. */
export const ALL_PLANNING_CAPABILITIES: PlanningCapabilities = {
	canRaiseIndent: true,
	canLock: true,
	canReplan: true
};

export function isPlanningAppData(value: unknown): value is PlanningAppData {
	if (!value || typeof value !== 'object') return false;
	const record = value as Record<string, unknown>;
	return typeof record.appName === 'string' && record.capabilities != null;
}

export function resolvePlanningAppData(data: unknown, fallbackAppName = 'RMI'): PlanningAppData {
	if (isPlanningAppData(data)) return data;
	return {
		appName: fallbackAppName,
		capabilities: ALL_PLANNING_CAPABILITIES
	};
}

/** True when this screen is hosted by a planning shell (not RMI stock flow). */
export function isPlanningShell(data: unknown): boolean {
	return isPlanningAppData(data);
}
