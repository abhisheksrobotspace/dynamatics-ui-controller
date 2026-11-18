/** Month range + weight helpers for manufacturing plan DS tree. */

import type { MfgDsProjectGroup, MfgDsProjectWeight } from './create-plan-ds.types.js';
import { computeMaxLoadingMt } from './plant-capacity.js';

const PLAN_MONTH_RE = /^(\d{4})-(\d{2})(?:-\d{2})?/;

export type MonthDateRange = {
	startDate: string;
	endDate: string;
};

/** Derive `[monthStart, monthEnd]` ISO dates from plan month `YYYY-MM` or `YYYY-MM-01`. */
export function monthRangeFromPlanMonth(month: string | null | undefined): MonthDateRange | null {
	if (!month) return null;
	const match = PLAN_MONTH_RE.exec(month.trim());
	if (!match) return null;
	const year = Number(match[1]);
	const monthNum = Number(match[2]);
	if (!Number.isFinite(year) || monthNum < 1 || monthNum > 12) return null;
	const startDate = `${match[1]}-${match[2]}-01`;
	const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
	const endDate = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`;
	return { startDate, endDate };
}

export function formatIsoDateDdMmYyyy(isoDate: string): string {
	const datePart = isoDate.slice(0, 10);
	const [year, month, day] = datePart.split('-');
	if (!year || !month || !day) return isoDate;
	return `${day}-${month}-${year}`;
}

/** Display label for a delivery schedule row: `name - date`, matching PMS. */
export function formatDeliveryScheduleLabel(
	name: string | null | undefined,
	dateLabel: string
): string {
	const trimmedName = name?.trim();
	if (trimmedName && dateLabel) return `${trimmedName} - ${dateLabel}`;
	return trimmedName || dateLabel;
}

export function weightMtFromRollupKg(
	requiredWeightKg: number | null | undefined,
	sets: number,
	overrideQty: number
): number | null {
	if (requiredWeightKg == null || !Number.isFinite(requiredWeightKg)) return null;
	if (!Number.isFinite(overrideQty) || overrideQty <= 0) return null;
	const scale = sets > 0 ? overrideQty / sets : 1;
	return (requiredWeightKg * scale) / 1000;
}

/** Sum child weights; null if any child weight is unknown (NULL-aware). */
export function sumWeightMtNullAware(weights: Array<number | null | undefined>): number | null {
	let sum = 0;
	for (const weight of weights) {
		if (weight == null || !Number.isFinite(weight)) return null;
		sum += weight;
	}
	return sum;
}

export function formatWeightMtCell(weightMt: number | null | undefined): string {
	if (weightMt == null || !Number.isFinite(weightMt)) return '-';
	return weightMt.toLocaleString('en-IN', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

/** Leaf BOM ids under the DS tree (for selection / draft). */
export function collectBomLeafIds(projects: MfgDsProjectGroup[]): string[] {
	const ids: string[] = [];
	for (const project of projects) {
		for (const schedule of project.schedules) {
			for (const structure of schedule.structures) {
				for (const bom of structure.boms) {
					ids.push(bom.id);
				}
			}
		}
	}
	return ids;
}

/** Count checked BOM leaves (ignores parent row selection in the tree). */
export function countSelectedBomLeaves(
	projects: MfgDsProjectGroup[],
	selectedIds: ReadonlySet<string>
): number {
	let count = 0;
	for (const project of projects) {
		for (const schedule of project.schedules) {
			for (const structure of schedule.structures) {
				for (const bom of structure.boms) {
					if (selectedIds.has(bom.id)) count += 1;
				}
			}
		}
	}
	return count;
}

export function rollupSelectedWeightByProject(
	projects: MfgDsProjectGroup[],
	selectedIds: ReadonlySet<string>
): MfgDsProjectWeight[] {
	const rows: MfgDsProjectWeight[] = [];
	for (const project of projects) {
		let weightMt = 0;
		let hasUnknown = false;
		for (const schedule of project.schedules) {
			for (const structure of schedule.structures) {
				for (const bom of structure.boms) {
					if (!selectedIds.has(bom.id)) continue;
					if (bom.weightMt == null || !Number.isFinite(bom.weightMt)) {
						hasUnknown = true;
						continue;
					}
					weightMt += bom.weightMt;
				}
			}
		}
		if (hasUnknown) continue;
		if (weightMt > 0) {
			rows.push({ projectId: project.projectId, title: project.title, weightMt });
		}
	}
	return rows;
}

export function sumSelectedWeightMt(
	projects: MfgDsProjectGroup[],
	selectedIds: ReadonlySet<string>
): number | null {
	let sum = 0;
	let anySelected = false;
	for (const project of projects) {
		for (const schedule of project.schedules) {
			for (const structure of schedule.structures) {
				for (const bom of structure.boms) {
					if (!selectedIds.has(bom.id)) continue;
					anySelected = true;
					if (bom.weightMt == null || !Number.isFinite(bom.weightMt)) return null;
					sum += bom.weightMt;
				}
			}
		}
	}
	return anySelected ? sum : 0;
}

export function isOverProductionTarget(
	selectedWeightMt: number | null | undefined,
	capacityMt: number | null,
	maxLoadingPct: number | null
): boolean {
	if (selectedWeightMt == null || !Number.isFinite(selectedWeightMt)) return false;
	const maxMt = computeMaxLoadingMt(capacityMt, maxLoadingPct);
	if (maxMt == null) return false;
	return selectedWeightMt > maxMt + 1e-9;
}
