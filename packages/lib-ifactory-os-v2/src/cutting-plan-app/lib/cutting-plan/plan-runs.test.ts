import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CpPlanRunRow } from './cp.rows';
import type { PlanResponse } from './types';

vi.mock('./cp-plan.api', () => ({
	listCorePlanRuns: vi.fn(),
	getCorePlanRun: vi.fn(),
	corePlanResponse: vi.fn(),
	// keep the real-ish shape so listPlanRuns' summary is populated
	runSummary: vi.fn((row: CpPlanRunRow) => ({
		total_sections: row.total_sections,
		total_bars: row.total_bars
	}))
}));

import * as cpPlanApi from './cp-plan.api';
const { listPlanRuns, getPlanRun, getLatestPlanRun, bomHasPriorCompletedPlanRun } =
	await import('./plan-runs');

function runRow(overrides: Partial<CpPlanRunRow> = {}): CpPlanRunRow {
	return {
		run_id: 'run-1',
		bom_id: 'bom-1',
		version: 1,
		run_type: 'full',
		status: 'completed',
		plan_job_id: 'job-1',
		sections_planned: ['SECTION-1'],
		section_plan_ids: ['sp-1'],
		request: null,
		total_bars: 4,
		total_sections: 2,
		total_stock_mm: '6000',
		total_waste_mm: '200',
		total_required_mm: '5800',
		total_stock_weight_kg: null,
		total_waste_weight_kg: null,
		total_required_weight_kg: null,
		waste_pct_length: '3.33',
		waste_pct_weight: null,
		optimal_sections: 2,
		feasible_sections: 0,
		error: null,
		created_at: '2026-07-09T00:00:00Z',
		...overrides
	};
}

describe('plan-runs (core mode)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('maps cp_plan_runs rows → CuttingPlanRun (header + summary), newest first from server order', async () => {
		vi.mocked(cpPlanApi.listCorePlanRuns).mockResolvedValue([
			runRow({ run_id: 'run-2', version: 2, run_type: 'partial' }),
			runRow({ run_id: 'run-1', version: 1 })
		]);

		const runs = await listPlanRuns('bom-1');

		expect(runs).toHaveLength(2);
		expect(runs[0]).toMatchObject({ id: 'run-2', version: 2, type: 'partial' });
		expect(runs[1]).toMatchObject({ id: 'run-1', version: 1, type: 'full' });
		expect(runs[0].sectionsPlanned).toEqual(['SECTION-1']);
		expect(runs[0].ranBy).toBe('');
		expect(runs[0].publishedAt).toBe('');
		expect(runs[0].publishedBy).toBe('');
		expect(runs[0].response.result?.total_bars).toBe(4);
	});

	it('maps metadata.ran_by onto CuttingPlanRun.ranBy', async () => {
		vi.mocked(cpPlanApi.listCorePlanRuns).mockResolvedValue([
			runRow({ metadata: { ran_by: 'planner@example.com' } })
		]);

		const runs = await listPlanRuns('bom-1');
		expect(runs[0].ranBy).toBe('planner@example.com');
	});

	it('maps published_at / published_by onto CuttingPlanRun', async () => {
		vi.mocked(cpPlanApi.listCorePlanRuns).mockResolvedValue([
			runRow({
				status: 'published',
				published_at: '2026-08-21T10:00:00Z',
				published_by: 'publisher@example.com'
			})
		]);

		const runs = await listPlanRuns('bom-1');
		expect(runs[0].publishedAt).toBe('2026-08-21T10:00:00Z');
		expect(runs[0].publishedBy).toBe('publisher@example.com');
	});

	it('getPlanRun assembles the PlanResponse for one run (default detail bars)', async () => {
		const response: PlanResponse = { bom_id: 'bom-1', result: {}, output: { 'SECTION-1': {} } };
		vi.mocked(cpPlanApi.getCorePlanRun).mockResolvedValue(runRow());
		vi.mocked(cpPlanApi.corePlanResponse).mockResolvedValue(response);

		const run = await getPlanRun('bom-1', 'run-1');
		expect(run?.id).toBe('run-1');
		expect(run?.response).toBe(response);
		expect(cpPlanApi.corePlanResponse).toHaveBeenCalledWith(expect.anything(), { bars: 'detail' });
	});

	it('getPlanRun passes bars: summary when requested', async () => {
		vi.mocked(cpPlanApi.getCorePlanRun).mockResolvedValue(runRow());
		vi.mocked(cpPlanApi.corePlanResponse).mockResolvedValue({ bom_id: 'bom-1', output: {} });

		await getPlanRun('bom-1', 'run-1', { bars: 'summary' });
		expect(cpPlanApi.corePlanResponse).toHaveBeenCalledWith(expect.anything(), {
			bars: 'summary'
		});
	});

	it('getPlanRun returns null when the run is missing', async () => {
		vi.mocked(cpPlanApi.getCorePlanRun).mockResolvedValue(null);
		expect(await getPlanRun('bom-1', 'nope')).toBeNull();
	});

	it('getLatestPlanRun resolves the highest-version run header without assembling bars', async () => {
		vi.mocked(cpPlanApi.listCorePlanRuns).mockResolvedValue([
			runRow({ run_id: 'run-3', version: 3 }),
			runRow({ run_id: 'run-1', version: 1 })
		]);

		const latest = await getLatestPlanRun('bom-1');
		expect(latest?.id).toBe('run-3');
		expect(latest?.version).toBe(3);
		expect(cpPlanApi.corePlanResponse).not.toHaveBeenCalled();
	});

	it('getLatestPlanRun returns null when there are no runs', async () => {
		vi.mocked(cpPlanApi.listCorePlanRuns).mockResolvedValue([]);
		expect(await getLatestPlanRun('bom-1')).toBeNull();
	});

	it('bomHasPriorCompletedPlanRun is true only for completed/published runs', async () => {
		vi.mocked(cpPlanApi.listCorePlanRuns).mockResolvedValue([]);
		expect(await bomHasPriorCompletedPlanRun('bom-1')).toBe(false);

		vi.mocked(cpPlanApi.listCorePlanRuns).mockResolvedValue([
			runRow({ run_id: 'r-fail', status: 'failed' })
		]);
		expect(await bomHasPriorCompletedPlanRun('bom-1')).toBe(false);

		vi.mocked(cpPlanApi.listCorePlanRuns).mockResolvedValue([
			runRow({ run_id: 'r-ok', status: 'completed' })
		]);
		expect(await bomHasPriorCompletedPlanRun('bom-1')).toBe(true);
	});
});
