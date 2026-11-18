import { describe, expect, it } from 'vitest';
import { computePlanResultSummary, mergePlanResults } from './planner-results';
import type { PlanResponse } from './types';

function sectionOutput(
	name: string,
	overrides: {
		bars?: number;
		stock?: number;
		waste?: number;
		required?: number;
		weight?: number;
		status?: string;
	} = {}
) {
	return {
		result: {
			status: overrides.status ?? 'optimal',
			num_bars: overrides.bars ?? 1,
			total_stock_length: overrides.stock ?? 1000,
			waste: overrides.waste ?? 100,
			total_required_length: overrides.required ?? 900,
			total_stock_weight_kg: overrides.weight ?? 10,
			total_waste_weight_kg: 1,
			total_required_weight_kg: 9
		},
		plan: [{ rmid: `${name}-1`, rm_length: overrides.stock ?? 1000, quantity: 1, markings: [] }]
	};
}

describe('mergePlanResults', () => {
	it('keeps previous sections and replaces replanned ones after partial replan', () => {
		const previous: PlanResponse = {
			bom_id: 'bom-1',
			result: {
				total_sections: 3,
				total_bars: 6,
				total_stock: 6000,
				total_waste: 600
			},
			output: {
				'HT ANGLE 100x100x6': sectionOutput('HT ANGLE 100x100x6', {
					bars: 2,
					stock: 2000,
					waste: 200,
					required: 1800,
					weight: 20
				}),
				'HT ANGLE 100x100x7': sectionOutput('HT ANGLE 100x100x7', {
					bars: 2,
					stock: 2000,
					waste: 200,
					required: 1800,
					weight: 22
				}),
				'HT ANGLE 180x180x16': sectionOutput('HT ANGLE 180x180x16', {
					bars: 2,
					stock: 2000,
					waste: 200,
					required: 1800,
					weight: 30
				})
			}
		};

		const incoming: PlanResponse = {
			bom_id: 'bom-1',
			result: {
				total_sections: 1,
				total_bars: 4,
				total_stock: 4000,
				total_waste: 400
			},
			output: {
				'HT ANGLE 100x100x7': sectionOutput('HT ANGLE 100x100x7', {
					bars: 4,
					stock: 4000,
					waste: 400,
					required: 3600,
					weight: 42,
					status: 'feasible'
				})
			}
		};

		const merged = mergePlanResults(previous, incoming);

		expect(Object.keys(merged.output ?? {})).toHaveLength(3);
		expect(merged.output?.['HT ANGLE 100x100x6']?.result?.num_bars).toBe(2);
		expect(merged.output?.['HT ANGLE 100x100x7']?.result?.num_bars).toBe(4);
		expect(merged.output?.['HT ANGLE 180x180x16']?.result?.num_bars).toBe(2);
		expect(merged.result?.total_bars).toBe(8);
		expect(merged.result?.total_stock).toBe(8000);
		expect(merged.result?.total_waste).toBe(800);
	});

	it('recomputes summary totals from merged output', () => {
		const output = {
			A: sectionOutput('A', { bars: 1, stock: 1000, waste: 100, required: 900, weight: 10 }),
			B: sectionOutput('B', { bars: 2, stock: 2000, waste: 200, required: 1800, weight: 20 })
		};

		const summary = computePlanResultSummary(output);

		expect(summary?.total_sections).toBe(2);
		expect(summary?.total_bars).toBe(3);
		expect(summary?.total_stock).toBe(3000);
		expect(summary?.total_waste).toBe(300);
		expect(summary?.total_required_length).toBe(2700);
		expect(summary?.total_stock_weight_kg).toBe(30);
	});
});
