/** Session handoff from Stock Assignment home → Lock screen. */

export type StockAssignmentProjectScope = {
	projectId: string;
	projectLabel: string;
	deliveryScheduleIds: string[];
	bomIds: string[];
};

export type StockAssignmentScope = {
	plantId: string;
	/** Calendar month (`YYYY-MM` or first-day date). */
	months: string[];
	projects: StockAssignmentProjectScope[];
};

const KEY = 'rmi.stockAssignmentScope';

export function stashStockAssignmentScope(payload: StockAssignmentScope): void {
	sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function readStockAssignmentScope(): StockAssignmentScope | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StockAssignmentScope;
		if (!parsed.plantId || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
			return null;
		}
		return {
			...parsed,
			months: Array.isArray(parsed.months) ? parsed.months : []
		};
	} catch {
		return null;
	}
}

export function clearStockAssignmentScope(): void {
	sessionStorage.removeItem(KEY);
}
