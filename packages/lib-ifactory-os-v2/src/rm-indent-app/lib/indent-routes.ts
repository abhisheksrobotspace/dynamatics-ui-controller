import { num } from './inv.num.js';
import { invList } from './inv.api.js';
import type { InvSource } from './inv.types.js';

const indentLabels = new Map<string, string>();

export function indentDetailHash(indentId: string): string {
	return `Indents/${encodeURIComponent(indentId)}`;
}

export function indentDetailUrl(indentId: string, appName: string): string {
	return `#/${appName}/${indentDetailHash(indentId)}`;
}

/** Indent detail under a plan + project (keeps Central Planning breadcrumb trail). */
export function projectIndentDetailUrl(
	appName: string,
	planId: string,
	projectId: string,
	indentId: string
): string {
	return `#/${appName}/ManufacturingPlan/${encodeURIComponent(planId)}/GroupedAssignAndLock/${encodeURIComponent(projectId)}/Indents/${encodeURIComponent(indentId)}`;
}

export function getIndentLabel(indentId: string): string | undefined {
	const raw = indentId.trim();
	if (!raw) return undefined;
	return indentLabels.get(raw) ?? indentLabels.get(decodeURIComponent(raw));
}

export function setIndentLabel(indentId: string, label: string): void {
	const raw = indentId.trim();
	if (!raw) return;
	indentLabels.set(raw, label);
	const decoded = decodeURIComponent(raw);
	if (decoded !== raw) indentLabels.set(decoded, label);
}

/**
 * Resolve `#N - RN` for breadcrumbs on refresh / deep-link when the label cache is cold.
 */
export async function ensureIndentLabel(indentId: string, signal?: AbortSignal): Promise<string> {
	const id = decodeURIComponent(indentId.trim());
	if (!id) return indentId;
	const cached = getIndentLabel(id);
	if (cached && cached !== id) return cached;

	const rows = await invList<Record<string, unknown>>(
		'inv_indents',
		{
			indent_id: id,
			select: 'indent_id,indent_no,revision',
			limit: 1
		},
		signal
	);
	const row = rows[0];
	if (!row) {
		setIndentLabel(id, id);
		return id;
	}
	const indentNo = num(row.indent_no);
	const revision = num(row.revision);
	const label = `#${indentNo} - R${revision}`;
	setIndentLabel(id, label);
	return label;
}

export type RaiseIndentRow = {
	itemId: string;
	section: string;
	lengthMm: number;
	requiredQty: number;
	availableQty: number;
	lockedQty: number;
	requiredWeightKg?: number | null;
	lockedWeightKg?: number | null;
};

/** Match a build_indent line to a stashed/selected row. Item id is optional — unresolved rows get one after auto-create. */
export function indentLineMatchesRow(
	line: { item_id?: string; section?: string; variant_key?: string; length_mm?: number | string },
	row: { itemId?: string; section: string; lengthMm: number }
): boolean {
	const lineLen =
		line.length_mm != null && line.length_mm !== ''
			? Math.round(num(line.length_mm))
			: Math.round(num(String(line.variant_key ?? '').match(/L=(\d+)/i)?.[1] ?? 0));
	if (lineLen !== row.lengthMm) return false;
	const lineSection = String(line.section ?? '').trim();
	const rowSection = row.section.trim();
	if (rowSection && lineSection && lineSection !== rowSection) return false;
	const lineItem = String(line.item_id ?? '');
	if (row.itemId && lineItem && lineItem !== row.itemId) return false;
	return true;
}

export type RaiseIndentStash = {
	projectId: string;
	plantId?: string;
	planId: string;
	month?: string;
	rowKeys?: string[];
	/** @deprecated Rev 3 — ignored; required is computed server-side. */
	sources?: InvSource[];
	rows: RaiseIndentRow[];
	/**
	 * Central Planning sheet scope — whole delivery schedules (not APS MP links).
	 * Passed through to build_indent when creating the document.
	 */
	deliveryScheduleIds?: string[];
	/** Optional BOM filter within those schedules (sheet month allocation). */
	bomIds?: string[];
};

const RAISE_INDENT_STASH_KEY = 'rmi.raiseIndent';

export function stashRaiseIndent(payload: RaiseIndentStash): void {
	sessionStorage.setItem(RAISE_INDENT_STASH_KEY, JSON.stringify(payload));
}

export function readRaiseIndent(projectId: string): RaiseIndentStash | null {
	try {
		const raw = sessionStorage.getItem(RAISE_INDENT_STASH_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as RaiseIndentStash;
		if (parsed.projectId !== projectId || !Array.isArray(parsed.rows) || parsed.rows.length === 0) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export type GenerateIndentStash = {
	planId: string;
	projectId: string;
	batchName: string;
};

const GENERATE_INDENT_STASH_KEY = 'rmi.generateIndent';

export function stashGenerateIndent(payload: GenerateIndentStash): void {
	sessionStorage.setItem(GENERATE_INDENT_STASH_KEY, JSON.stringify(payload));
}

export function readGenerateIndent(): GenerateIndentStash | null {
	try {
		const raw = sessionStorage.getItem(GENERATE_INDENT_STASH_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as GenerateIndentStash;
		if (!parsed.planId || !parsed.projectId) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clearGenerateIndent(): void {
	sessionStorage.removeItem(GENERATE_INDENT_STASH_KEY);
}

/** Central Planning — sheet project/month scope for the section tree (not APS MP). */
export type CpRaiseIndentScope = {
	projectId: string;
	month: string;
	deliveryScheduleIds: string[];
	bomIds: string[];
	/** Sheet plan id used as mfg_plan_ref on the indent. */
	mfgPlanRef: string;
	/** Sheet route plan id (may equal mfgPlanRef). */
	sheetPlanId: string;
};

const CP_RAISE_INDENT_SCOPE_KEY = 'cp.raiseIndentScope';

export function stashCpRaiseIndentScope(payload: CpRaiseIndentScope): void {
	sessionStorage.setItem(CP_RAISE_INDENT_SCOPE_KEY, JSON.stringify(payload));
}

export function readCpRaiseIndentScope(projectId: string): CpRaiseIndentScope | null {
	try {
		const raw = sessionStorage.getItem(CP_RAISE_INDENT_SCOPE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CpRaiseIndentScope;
		if (
			parsed.projectId !== projectId ||
			!parsed.month ||
			!parsed.mfgPlanRef ||
			!parsed.sheetPlanId ||
			!Array.isArray(parsed.deliveryScheduleIds) ||
			parsed.deliveryScheduleIds.length === 0
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function clearCpRaiseIndentScope(): void {
	sessionStorage.removeItem(CP_RAISE_INDENT_SCOPE_KEY);
}

/** RMI — Create Indent from a published Central Planning sheet plan + month (+ optional project). */
export type CreateIndentFromPlanScope = {
	planId: string;
	month: string;
	projectId?: string;
};

const CREATE_INDENT_FROM_PLAN_KEY = 'rmi.createIndentFromPlan';

export function stashCreateIndentFromPlan(payload: CreateIndentFromPlanScope): void {
	sessionStorage.setItem(CREATE_INDENT_FROM_PLAN_KEY, JSON.stringify(payload));
}

export function readCreateIndentFromPlan(): CreateIndentFromPlanScope | null {
	try {
		const raw = sessionStorage.getItem(CREATE_INDENT_FROM_PLAN_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CreateIndentFromPlanScope;
		if (!parsed.planId || !parsed.month) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clearCreateIndentFromPlan(): void {
	sessionStorage.removeItem(CREATE_INDENT_FROM_PLAN_KEY);
}

/** Selected section-length rows after the plan-month tree step. */
export type CreateIndentSelectionStash = {
	planId: string;
	month: string;
	plantId?: string;
	byProject: Array<{
		projectId: string;
		projectLabel: string;
		rowKeys: string[];
	}>;
};

const CREATE_INDENT_SELECTION_KEY = 'rmi.createIndentSelection';

export function stashCreateIndentSelection(payload: CreateIndentSelectionStash): void {
	sessionStorage.setItem(CREATE_INDENT_SELECTION_KEY, JSON.stringify(payload));
}

export function readCreateIndentSelection(): CreateIndentSelectionStash | null {
	try {
		const raw = sessionStorage.getItem(CREATE_INDENT_SELECTION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CreateIndentSelectionStash;
		if (
			!parsed.planId ||
			!parsed.month ||
			!Array.isArray(parsed.byProject) ||
			parsed.byProject.length === 0 ||
			parsed.byProject.every((entry) => !entry.rowKeys?.length)
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function clearCreateIndentSelection(): void {
	sessionStorage.removeItem(CREATE_INDENT_SELECTION_KEY);
}
