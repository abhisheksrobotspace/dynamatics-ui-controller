import { num, numOrNull } from './inv.num.js';

/** CP recommended length — prefer `cp_recommended_length_mm`, else legacy length/variant. */
export function recommendedLengthMmFromIndentLine(line: Record<string, unknown>): number {
	const recommended = numOrNull(
		line.cp_recommended_length_mm as string | number | null | undefined
	);
	if (recommended != null && recommended > 0) return Math.round(recommended);
	return lengthMmFromIndentLine(line);
}

/** Effective procure length — `procure_length_mm`, override, or recommendation. */
export function procureLengthMmFromIndentLine(line: Record<string, unknown>): number {
	const procure = numOrNull(line.procure_length_mm as string | number | null | undefined);
	if (procure != null && procure > 0) return Math.round(procure);
	const overridden = numOrNull(line.overridden_length_mm as string | number | null | undefined);
	if (overridden != null && overridden > 0) return Math.round(overridden);
	return recommendedLengthMmFromIndentLine(line);
}

/** Length in mm from `length_mm` or `variant_key` `L=…`. */
export function lengthMmFromIndentLine(line: Record<string, unknown>): number {
	if (line.length_mm != null && line.length_mm !== '') {
		return Math.round(num(line.length_mm as string | number));
	}
	return Math.round(num(String(line.variant_key ?? '').match(/L=(\d+)/i)?.[1] ?? 0));
}

/**
 * Derive kg/m from frozen required weight so edits can preview MT without
 * a separate unit-weight column on the indent line.
 */
export function unitWeightKgMFromIndentLine(line: Record<string, unknown>): number | null {
	const lengthMm = recommendedLengthMmFromIndentLine(line);
	const pcs = num(line.required_qty_base);
	const kg = numOrNull(line.required_weight_kg as string | number | null | undefined);
	if (kg == null || pcs <= 0 || lengthMm <= 0) {
		const unit = numOrNull(line.unit_weight_kg_m as string | number | null | undefined);
		return unit != null && unit > 0 ? unit : null;
	}
	const kgm = kg / ((pcs * lengthMm) / 1000);
	return Number.isFinite(kgm) && kgm > 0 ? kgm : null;
}

/** `pcs × (length_mm / 1000) × kg/m` — null when kg/m or length unknown. */
export function weightKgForPcs(
	pcs: number,
	lengthMm: number,
	kgm: number | null | undefined
): number | null {
	if (kgm == null || kgm <= 0 || lengthMm <= 0 || !Number.isFinite(pcs)) return null;
	return (pcs * lengthMm * kgm) / 1000;
}

/** Replace or set `L=` in variant_key. */
export function variantKeyWithLength(variantKey: string, lengthMm: number): string {
	const next = Math.round(lengthMm);
	if (next <= 0) return variantKey;
	if (/L=\d+/i.test(variantKey)) return variantKey.replace(/L=\d+/i, `L=${next}`);
	return `L=${next}`;
}

export type IndentLineEditDraft = {
	indent_line_id: string;
	item_id: string;
	section: string;
	item_code: string;
	/** Frozen CP recommendation — display only. */
	cp_recommended_length_mm: number;
	/** Editable to-procure length (maps to overridden_length_mm when ≠ recommended). */
	procure_length_mm: number;
	required_qty_base: number;
	locked_qty_base: number;
	stock_qty_base: number;
	/** Editable to-procure pcs. */
	procure_qty_base: number;
	unit_weight_kg_m: number | null;
	variant_key: string;
	/** True when the loaded line already had an override (so clearing needs `null`). */
	had_override: boolean;
	original_procure_qty_base: number;
};

export function procureQtyForEdit(edit: IndentLineEditDraft): number {
	return Math.max(0, edit.procure_qty_base);
}

function categoryFromCode(code: string): 'HT' | 'MS' | 'OTHER' {
	const upper = code.trim().toUpperCase();
	if (upper.startsWith('HT') || upper.includes(' HT ')) return 'HT';
	if (upper.startsWith('MS') || upper.includes(' MS ')) return 'MS';
	return 'OTHER';
}

/** Header metadata tonnage from edited procure weights (optimistic preview). */
export function mtTotalsFromLineEdits(edits: IndentLineEditDraft[]): {
	ht_mt: number;
	ms_mt: number;
	total_mt: number;
} {
	let ht = 0;
	let ms = 0;
	let other = 0;
	for (const edit of edits) {
		const procure = procureQtyForEdit(edit);
		const kg = weightKgForPcs(procure, Math.round(edit.procure_length_mm), edit.unit_weight_kg_m);
		if (kg == null) continue;
		const mt = kg / 1000;
		const cat = categoryFromCode(edit.section || edit.item_code || '');
		if (cat === 'HT') ht += mt;
		else if (cat === 'MS') ms += mt;
		else other += mt;
	}
	return { ht_mt: ht, ms_mt: ms, total_mt: ht + ms + other };
}

/** Reject empty length or non-finite procure qty. */
export function validateIndentLineEdits(edits: IndentLineEditDraft[]): string | null {
	for (const edit of edits) {
		const lengthMm = Math.round(edit.procure_length_mm);
		const label = edit.section || edit.item_code || 'line';
		if (!(lengthMm > 0)) {
			return `To Procure Length must be greater than 0 for ${label}`;
		}
		if (edit.procure_qty_base < 0 || !Number.isFinite(edit.procure_qty_base)) {
			return `To Procure (pcs) must be ≥ 0 for ${label}`;
		}
	}
	return null;
}

/** Apply floor after blur — returns the value to keep and whether it was clamped. */
export function resolveIndentEditNumberOnBlur(
	raw: string,
	floor: number,
	opts?: { integer?: boolean }
): { value: number; clamped: boolean } {
	const trimmed = raw.trim();
	const parsed = trimmed === '' ? Number.NaN : Number(trimmed);
	if (!Number.isFinite(parsed)) {
		return { value: floor, clamped: true };
	}
	const normalized = opts?.integer === false ? parsed : Math.round(parsed);
	if (normalized < floor) {
		return { value: floor, clamped: true };
	}
	return { value: normalized, clamped: false };
}
