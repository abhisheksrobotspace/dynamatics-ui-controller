import { invList } from './inv.api.js';
import { num } from './inv.num.js';
import type { InvStockLineRow, InvStockLockRow, StockPickRow } from './inv.types.js';

export type { StockPickRow };

export function variantKeyForLengthMm(lengthMm: number): string {
	return `L=${Math.round(lengthMm)}`;
}

export async function stockCandidatesForBar(input: {
	projectId: string;
	itemId: string;
	lengthMm: number;
	requiredQty: number;
	/** Plan / lock summary section — only lines with matching `bom_section` are offered (D5b). */
	section?: string;
	signal?: AbortSignal;
}): Promise<(StockPickRow & { stock_line_id: string; plant_id: string })[]> {
	const variantKey = variantKeyForLengthMm(input.lengthMm);
	const lines = await invList<InvStockLineRow & Record<string, unknown>>(
		'inv_stock_lines',
		{
			project_id: input.projectId,
			item_id: input.itemId,
			variant_key: variantKey,
			select:
				'stock_line_id,plant_id,bundle_no,lot_code,location_ref,physical_location,free_base,qty_base,locked_base,variant_key,bom_section'
		},
		input.signal
	);

	const section = input.section?.trim() ?? '';

	return lines
		.filter((line) => {
			if (num(line.free_base) <= 0) return false;
			const bomSection = typeof line.bom_section === 'string' ? line.bom_section.trim() : '';
			// NULL bom_section cannot be locked against a section (D5b).
			if (!bomSection) return false;
			if (!section) return true;
			return (
				bomSection.toLowerCase().replace(/\s+/g, ' ') === section.toLowerCase().replace(/\s+/g, ' ')
			);
		})
		.map((line) => {
			const free = num(line.free_base);
			return {
				id: line.stock_line_id,
				stock_line_id: line.stock_line_id,
				plant_id: String(line.plant_id ?? ''),
				bundle_no: line.bundle_no?.trim() || '-',
				batch: line.lot_code?.trim() || '-',
				physical_location: line.physical_location?.trim() || line.location_ref?.trim() || '-',
				free_pcs: free,
				free_label: String(free),
				take_qty: 0
			};
		});
}

/** Prefer an explicit plant; else any plant on this project's stock lines. */
export async function resolvePlantIdForAssign(input: {
	preferredPlantId?: string | null;
	projectId: string;
	stockLinePlantId?: string | null;
	signal?: AbortSignal;
}): Promise<string> {
	const preferred = input.preferredPlantId?.trim();
	if (preferred) return preferred;
	const fromStock = input.stockLinePlantId?.trim();
	if (fromStock) return fromStock;

	const lines = await invList<InvStockLineRow & Record<string, unknown>>(
		'inv_stock_lines',
		{
			project_id: input.projectId,
			select: 'plant_id',
			limit: 1
		},
		input.signal
	);
	return String(lines[0]?.plant_id ?? '').trim();
}

/** Active MP-owned lock ids for Unlock All. */
export async function listActiveManufacturingPlanLockIds(
	planId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<string[]> {
	const locks = await invList<InvStockLockRow & Record<string, unknown>>(
		'inv_stock_locks',
		{
			project_id: projectId,
			owner_type: 'manufacturing_plan',
			owner_ref: planId,
			status: 'active',
			select: 'lock_id',
			limit: 50000
		},
		signal
	);
	return locks.map((lock) => String(lock.lock_id ?? '')).filter(Boolean);
}
