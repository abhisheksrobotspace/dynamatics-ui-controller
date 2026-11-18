import { describe, expect, it } from 'vitest';
import { runSummary } from './cp-plan.api';
import type { CpPlanRunRow } from './cp.rows';

function row(overrides: Partial<CpPlanRunRow> = {}): CpPlanRunRow {
	return {
		run_id: 'r',
		bom_id: 'b',
		version: 1,
		run_type: 'full',
		status: 'completed',
		plan_job_id: null,
		sections_planned: [],
		section_plan_ids: [],
		request: null,
		total_bars: 7,
		total_sections: 3,
		total_stock_mm: '12000',
		total_waste_mm: '400',
		total_required_mm: '11600',
		total_stock_weight_kg: '950.5',
		total_waste_weight_kg: null,
		total_required_weight_kg: '900',
		waste_pct_length: '3.33',
		waste_pct_weight: '4.1',
		optimal_sections: 2,
		feasible_sections: 1,
		error: null,
		...overrides
	};
}

describe('runSummary', () => {
	it('coerces numeric-as-string columns to numbers', () => {
		const s = runSummary(row());
		expect(s.total_bars).toBe(7);
		expect(s.total_sections).toBe(3);
		expect(s.total_stock).toBe(12000);
		expect(s.total_waste).toBe(400);
		expect(s.total_required_length).toBe(11600);
		expect(s.total_stock_weight_kg).toBe(950.5);
		expect(s.total_required_weight_kg).toBe(900);
		expect(s.waste_pct_length).toBe(3.33);
		expect(s.waste_pct_weight).toBe(4.1);
		expect(s.optimal_sections).toBe(2);
		expect(s.feasible_sections).toBe(1);
	});

	it('maps null numeric columns to null (weights) / undefined (length metrics)', () => {
		const s = runSummary(row({ total_waste_weight_kg: null, total_waste_mm: null }));
		expect(s.total_waste_weight_kg).toBeNull();
		expect(s.total_waste).toBeUndefined();
	});
});
