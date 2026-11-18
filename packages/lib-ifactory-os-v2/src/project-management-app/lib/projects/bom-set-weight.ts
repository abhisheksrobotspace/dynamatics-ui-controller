import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { projBomItemsListPath } from './proj-bom-items.constants.js';

/** Datahub `select` for one kg total per BOM. Do not request mark lines. */
export const BOM_SET_WEIGHT_SELECT = 'bom_id,sum(total_weight) as kg';

type BomSetWeightRow = {
	bom_id?: string;
	kg?: unknown;
};

function uniqueBomIds(bomIds: string[]): string[] {
	return [...new Set(bomIds.filter((id) => id.length > 0))];
}

function parseKg(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

/**
 * Display weight in MT: `setKg * qty / 1000`.
 * Missing kg or non-positive qty is `-`.
 */
export function formatWeightMt(setKg: number | undefined, qty: number): string {
	if (setKg === undefined || !Number.isFinite(setKg) || !Number.isFinite(qty) || qty <= 0) {
		return '-';
	}
	return ((setKg * qty) / 1000).toFixed(2);
}

/** Keep `__in=` under proxy/header limits (HTTP 431) — same budget as planning-sheet.load. */
function chunkBomIds(ids: string[], maxEncodedLen = 2500): string[][] {
	const chunks: string[][] = [];
	let current: string[] = [];
	let encodedLen = 0;
	for (const id of ids) {
		const piece = encodeURIComponent(id);
		const next = encodedLen === 0 ? piece.length : encodedLen + 1 + piece.length;
		if (current.length > 0 && next > maxEncodedLen) {
			chunks.push(current);
			current = [];
			encodedLen = 0;
		}
		current.push(id);
		encodedLen = encodedLen === 0 ? piece.length : encodedLen + 1 + piece.length;
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

/**
 * One `SUM(total_weight)` row per BOM via Datahub groupBy — not every mark line.
 */
export async function listBomSetWeightKgByBomIds(
	bomIds: string[],
	signal?: AbortSignal
): Promise<Map<string, number>> {
	const ids = uniqueBomIds(bomIds);
	const kgByBomId = new Map<string, number>();
	if (ids.length === 0) return kgByBomId;

	for (const chunk of chunkBomIds(ids)) {
		const envelope = await apiClient.get<ApiEnvelope<BomSetWeightRow[]>>(
			apiClient.datahub(
				projBomItemsListPath(
					{ bom_id__in: chunk.join(',') },
					{
						limit: 5000,
						select: BOM_SET_WEIGHT_SELECT,
						groupBy: 'bom_id'
					}
				)
			),
			{ signal }
		);

		for (const row of rowsFromEnvelope<BomSetWeightRow>(envelope.data)) {
			const bomId = row.bom_id;
			if (!bomId) continue;
			const kg = parseKg(row.kg);
			if (kg === undefined) continue;
			kgByBomId.set(bomId, kg);
		}
	}

	return kgByBomId;
}
