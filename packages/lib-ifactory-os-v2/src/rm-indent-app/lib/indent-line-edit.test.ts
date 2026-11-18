import { describe, expect, it } from 'vitest';
import {
	lengthMmFromIndentLine,
	mtTotalsFromLineEdits,
	procureLengthMmFromIndentLine,
	recommendedLengthMmFromIndentLine,
	resolveIndentEditNumberOnBlur,
	unitWeightKgMFromIndentLine,
	validateIndentLineEdits,
	variantKeyWithLength,
	weightKgForPcs,
	type IndentLineEditDraft
} from './indent-line-edit.js';

function draft(
	partial: Partial<IndentLineEditDraft> & Pick<IndentLineEditDraft, 'indent_line_id'>
): IndentLineEditDraft {
	const lengthMm = partial.procure_length_mm ?? partial.cp_recommended_length_mm ?? 6000;
	const requiredQty = partial.required_qty_base ?? 10;
	const procureQty =
		partial.procure_qty_base ?? Math.max(0, requiredQty - (partial.locked_qty_base ?? 2));
	return {
		item_id: 'item-1',
		section: 'HT ANGLE 75X75X5',
		item_code: 'HT ANGLE 75X75X5',
		cp_recommended_length_mm: lengthMm,
		procure_length_mm: lengthMm,
		required_qty_base: requiredQty,
		locked_qty_base: 2,
		stock_qty_base: 5,
		procure_qty_base: procureQty,
		unit_weight_kg_m: 5.5,
		variant_key: 'L=6000',
		had_override: false,
		original_procure_qty_base: procureQty,
		...partial
	};
}

describe('indent-line-edit', () => {
	it('reads length from length_mm or variant_key', () => {
		expect(lengthMmFromIndentLine({ length_mm: 11500 })).toBe(11500);
		expect(lengthMmFromIndentLine({ variant_key: 'L=7800' })).toBe(7800);
	});

	it('prefers cp_recommended and procure_length fields', () => {
		expect(
			recommendedLengthMmFromIndentLine({
				cp_recommended_length_mm: 6400,
				length_mm: 6000
			})
		).toBe(6400);
		expect(
			procureLengthMmFromIndentLine({
				cp_recommended_length_mm: 6400,
				overridden_length_mm: 11325
			})
		).toBe(11325);
		expect(
			procureLengthMmFromIndentLine({
				cp_recommended_length_mm: 6400,
				procure_length_mm: 11325
			})
		).toBe(11325);
	});

	it('derives kg/m from frozen required weight', () => {
		// 10 pcs × 6 m × 5.5 kg/m = 330 kg
		expect(
			unitWeightKgMFromIndentLine({
				required_qty_base: 10,
				cp_recommended_length_mm: 6000,
				required_weight_kg: 330
			})
		).toBeCloseTo(5.5);
	});

	it('recomputes weight from pcs × length × kg/m', () => {
		expect(weightKgForPcs(10, 6000, 5.5)).toBeCloseTo(330);
		expect(weightKgForPcs(8, 6000, null)).toBeNull();
	});

	it('updates L= in variant_key', () => {
		expect(variantKeyWithLength('L=6000', 7800)).toBe('L=7800');
		expect(variantKeyWithLength('', 7800)).toBe('L=7800');
	});

	it('rejects invalid length and negative procure qty', () => {
		expect(validateIndentLineEdits([draft({ indent_line_id: 'a', procure_length_mm: 0 })])).toMatch(
			/To Procure Length must/
		);
		expect(
			validateIndentLineEdits([
				draft({
					indent_line_id: 'a',
					procure_qty_base: -1
				})
			])
		).toMatch(/To Procure \(pcs\) must/);
	});

	it('allows the same item at the same to-procure length on distinct lines', () => {
		// Display may merge these (Required Length "–"); persist stays per indent_line_id.
		expect(
			validateIndentLineEdits([
				draft({
					indent_line_id: 'a',
					cp_recommended_length_mm: 7800,
					procure_length_mm: 10200
				}),
				draft({
					indent_line_id: 'b',
					cp_recommended_length_mm: 9000,
					procure_length_mm: 10200
				})
			])
		).toBeNull();
	});

	it('clamps below-floor values only on blur resolve', () => {
		expect(resolveIndentEditNumberOnBlur('5000', 6000)).toEqual({
			value: 6000,
			clamped: true
		});
		expect(resolveIndentEditNumberOnBlur('7800', 6000)).toEqual({
			value: 7800,
			clamped: false
		});
		expect(resolveIndentEditNumberOnBlur('', 10, { integer: false })).toEqual({
			value: 10,
			clamped: true
		});
		expect(resolveIndentEditNumberOnBlur('12.5', 10, { integer: false })).toEqual({
			value: 12.5,
			clamped: false
		});
	});

	it('sums HT/MS procure MT for header metadata', () => {
		const totals = mtTotalsFromLineEdits([
			draft({
				indent_line_id: 'a',
				section: 'HT ANGLE',
				required_qty_base: 10,
				locked_qty_base: 0,
				procure_qty_base: 10
			}),
			draft({
				indent_line_id: 'b',
				section: 'MS PLATE',
				item_code: 'MS PLATE',
				required_qty_base: 10,
				locked_qty_base: 0,
				procure_qty_base: 10
			})
		]);
		const expectedMt = (10 * 6 * 5.5) / 1000;
		expect(totals.ht_mt).toBeCloseTo(expectedMt);
		expect(totals.ms_mt).toBeCloseTo(expectedMt);
		expect(totals.total_mt).toBeCloseTo(expectedMt * 2);
	});
});
