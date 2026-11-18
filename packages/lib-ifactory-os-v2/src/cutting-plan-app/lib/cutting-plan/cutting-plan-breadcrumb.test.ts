import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	appendCuttingPlanCreateBreadcrumbs,
	clearCuttingPlanBreadcrumbContext,
	prepareCuttingPlanBreadcrumbContext
} from './cutting-plan-breadcrumb';

vi.mock('./draft-cache', () => ({
	loadCuttingPlanDraft: vi.fn()
}));

vi.mock('./plan-runs', () => ({
	getLatestPlanRun: vi.fn()
}));

const { loadCuttingPlanDraft } = await import('./draft-cache');
const { getLatestPlanRun } = await import('./plan-runs');

afterEach(() => {
	clearCuttingPlanBreadcrumbContext();
	vi.clearAllMocks();
});

describe('appendCuttingPlanCreateBreadcrumbs', () => {
	it('uses the new-plan trail when not replanning', () => {
		const crumbs: Array<{ label: string; href: string; clickable: boolean }> = [];

		appendCuttingPlanCreateBreadcrumbs(crumbs, {
			bomBasePath: 'Home/p1/Towers/t1/Boms/b1',
			bomId: 'b1',
			page: 'StockLengths'
		});

		expect(crumbs.map((crumb) => crumb.label)).toEqual([
			'Cutting Plan',
			'Select Sections',
			'Stock Lengths'
		]);
	});

	it('uses Results trail when replanning from an existing plan', async () => {
		vi.mocked(loadCuttingPlanDraft).mockResolvedValue({
			selectedMarks: [],
			sections: [],
			replanFromExisting: true,
			replanSourceRunId: 'run-9'
		});
		await prepareCuttingPlanBreadcrumbContext('b1');

		const crumbs: Array<{ label: string; href: string; clickable: boolean }> = [];
		appendCuttingPlanCreateBreadcrumbs(crumbs, {
			bomBasePath: 'Home/p1/Towers/t1/Boms/b1',
			bomId: 'b1',
			page: 'Sections'
		});

		expect(crumbs.map((crumb) => crumb.label)).toEqual([
			'Cutting Plan',
			'Results',
			'Select Sections'
		]);
		expect(crumbs[1]?.href).toBe('Home/p1/Towers/t1/Boms/b1/Runs/run-9/Summary');
	});

	it('links Select Sections when replanning on Stock Lengths', async () => {
		vi.mocked(loadCuttingPlanDraft).mockResolvedValue({
			selectedMarks: [],
			sections: [],
			replanFromExisting: true,
			replanSourceRunId: 'run-9'
		});
		await prepareCuttingPlanBreadcrumbContext('b1');

		const crumbs: Array<{ label: string; href: string; clickable: boolean }> = [];
		appendCuttingPlanCreateBreadcrumbs(crumbs, {
			bomBasePath: 'Home/p1/Towers/t1/Boms/b1',
			bomId: 'b1',
			page: 'StockLengths'
		});

		expect(crumbs.map((crumb) => crumb.label)).toEqual([
			'Cutting Plan',
			'Results',
			'Select Sections',
			'Stock Lengths'
		]);
		expect(crumbs[2]?.clickable).toBe(true);
		expect(crumbs[2]?.href).toBe('Home/p1/Towers/t1/Boms/b1/Sections');
	});
});

describe('prepareCuttingPlanBreadcrumbContext', () => {
	it('falls back to the latest run when no source run is stored', async () => {
		vi.mocked(loadCuttingPlanDraft).mockResolvedValue({
			selectedMarks: [],
			sections: [],
			replanFromExisting: true
		});
		vi.mocked(getLatestPlanRun).mockResolvedValue({
			id: 'run-latest',
			version: 2,
			createdAt: '',
			type: 'full',
			status: 'completed',
			sectionPlanIds: [],
			sectionsPlanned: [],
			response: null
		});

		await prepareCuttingPlanBreadcrumbContext('b1');

		const crumbs: Array<{ label: string; href: string; clickable: boolean }> = [];
		appendCuttingPlanCreateBreadcrumbs(crumbs, {
			bomBasePath: 'Home/p1/Towers/t1/Boms/b1',
			bomId: 'b1',
			page: 'Sections'
		});

		expect(crumbs[1]?.href).toBe('Home/p1/Towers/t1/Boms/b1/Runs/run-latest/Summary');
	});
});
