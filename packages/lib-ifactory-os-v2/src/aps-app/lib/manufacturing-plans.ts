/** UI row for Manufacturing Plans Home. */
import { getShopfloorPlan } from '../../central-planning-app/lib/pln.api.js';
import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load.js';
import { apsPlanBasePath } from './aps-host.js';
import { getManufacturingPlan } from './plans.api.js';
import { ensureScheduleRequestLabel } from './schedule-requests.api.js';

export type ManufacturingPlan = {
	id: string;
	/** User-entered display name. */
	name: string;
	/** System plan id e.g. MP-2026-07-A */
	planCode: string;
	month: string;
	workOrders: string;
	structures: number;
	batchWt: number;
	plant: string;
	zincReq: number;
	dueDate: string;
	priority: string;
	status: string;
};

const planLabelById = new Map<string, string>();

/** Prefer plan name for breadcrumbs; fall back to plan id. */
export function getManufacturingPlanLabel(planId: string): string {
	return planLabelById.get(planId) ?? planId;
}

export function rememberManufacturingPlanLabel(planId: string, name: string): void {
	const trimmed = name.trim();
	if (trimmed) planLabelById.set(planId, trimmed);
	else planLabelById.delete(planId);
}

/** Fetch request name for breadcrumbs on deep-link / reload when the in-memory map is cold. */
export async function ensureManufacturingPlanLabel(
	planId: string,
	signal?: AbortSignal
): Promise<string> {
	if (planLabelById.has(planId)) return getManufacturingPlanLabel(planId);

	const fromRequest = await ensureScheduleRequestLabel(planId, signal).catch(() => '');
	if (fromRequest && fromRequest !== planId) {
		rememberManufacturingPlanLabel(planId, fromRequest);
		return fromRequest;
	}

	const shopfloor = await getShopfloorPlan(planId, signal).catch(() => null);
	if (shopfloor) {
		const monthLabel = formatMonthLabel(shopfloor.month?.slice(0, 7) ?? '');
		const label =
			shopfloor.name?.trim() ||
			(monthLabel ? `Shop Floor · ${monthLabel}` : shopfloor.shopfloor_plan_id);
		rememberManufacturingPlanLabel(planId, label);
		return getManufacturingPlanLabel(planId);
	}

	const plan = await getManufacturingPlan(planId, signal);
	if (plan) {
		rememberManufacturingPlanLabel(planId, plan.name?.trim() || plan.plan_id);
	}
	return getManufacturingPlanLabel(planId);
}

export function rememberManufacturingPlanLabels(plans: ManufacturingPlan[]): void {
	for (const plan of plans) {
		rememberManufacturingPlanLabel(plan.id, plan.name || plan.planCode);
	}
}

export function scheduleSetupHash(planId: string): string {
	return `${apsPlanBasePath(planId)}/Review`;
}

export function reviewInputHash(planId: string): string {
	return `${apsPlanBasePath(planId)}/Review`;
}

/** Open Review Input for a shopfloor plan (legacy name kept for callers). */
export function viewPlanHash(planId: string): string {
	return reviewInputHash(planId);
}

/** Plan bundle (SD selection) stays editable until an APS run locks it. */
export function isManufacturingPlanBundleEditable(status: string | null | undefined): boolean {
	return status === 'draft' || status === 'scheduling_input' || status === 'failed';
}

export function formatPlanMonth(month: string | null | undefined): string {
	if (!month) return '-';
	const datePart = month.slice(0, 10);
	const [year, monthNum] = datePart.split('-');
	if (!year || !monthNum) return month;
	const date = new Date(Date.UTC(Number(year), Number(monthNum) - 1, 1));
	if (Number.isNaN(date.getTime())) return month;
	return date.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatPlanDueDate(dueDate: string | null | undefined): string {
	if (!dueDate) return '-';
	const parsed = new Date(dueDate);
	if (Number.isNaN(parsed.getTime())) return dueDate;
	return parsed.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function formatPlanStatus(status: string | null | undefined): string {
	switch (status) {
		case 'draft':
			return 'Draft';
		case 'scheduling_input':
			return 'Scheduling input';
		case 'scheduling':
			return 'Scheduling';
		case 'scheduled':
			return 'Scheduled';
		case 'completed':
			return 'Completed';
		case 'failed':
			return 'Failed';
		default:
			return status?.trim() || '-';
	}
}

function numberFromSummary(summary: Record<string, unknown> | undefined, key: string): number {
	const value = summary?.[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringFromSummary(summary: Record<string, unknown> | undefined, key: string): string {
	const value = summary?.[key];
	if (typeof value === 'string' && value.trim()) return value.trim();
	return '-';
}

function workOrdersFromSummary(summary: Record<string, unknown> | undefined): string {
	const value = summary?.work_orders;
	if (Array.isArray(value)) {
		const parts = value.filter(
			(item): item is string => typeof item === 'string' && item.trim().length > 0
		);
		return parts.length > 0 ? parts.join(', ') : '-';
	}
	if (typeof value === 'string' && value.trim()) return value.trim();
	return '-';
}

export type ManufacturingPlanApiRow = {
	plan_id: string;
	name?: string | null;
	month?: string | null;
	due_date?: string | null;
	priority?: number | null;
	status: string;
	summary?: Record<string, unknown>;
};

export function mapManufacturingPlanRow(row: ManufacturingPlanApiRow): ManufacturingPlan {
	const summary = row.summary && typeof row.summary === 'object' ? row.summary : {};
	const name = row.name?.trim() || row.plan_id;
	return {
		id: row.plan_id,
		name,
		planCode: row.plan_id,
		month: formatPlanMonth(row.month),
		workOrders: workOrdersFromSummary(summary),
		structures: numberFromSummary(summary, 'structures'),
		batchWt: numberFromSummary(summary, 'batch_weight_mt'),
		plant: stringFromSummary(summary, 'plants'),
		zincReq: numberFromSummary(summary, 'zinc_req_mt'),
		dueDate: formatPlanDueDate(row.due_date),
		priority: row.priority == null ? '-' : String(row.priority),
		status: formatPlanStatus(row.status)
	};
}
