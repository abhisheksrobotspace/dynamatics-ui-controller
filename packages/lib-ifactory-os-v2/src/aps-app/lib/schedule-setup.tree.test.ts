import { describe, expect, it } from 'vitest';
import type { ScheduleSetupBomRow } from './schedule-setup.api.js';
import {
	buildScheduleSetupTree,
	projectLabel,
	scheduleSetupTreeFilterMatch
} from './schedule-setup.tree.js';

function bom(
	partial: Partial<ScheduleSetupBomRow> & Pick<ScheduleSetupBomRow, 'id'>
): ScheduleSetupBomRow {
	return {
		bomId: partial.bomId ?? partial.id,
		bomName: partial.bomName ?? 'BOM',
		projectId: partial.projectId ?? 'p1',
		projectName: partial.projectName ?? 'Test Project',
		workOrderCode: partial.workOrderCode ?? 'WO-1',
		scheduleId: partial.scheduleId ?? 'ds1',
		scheduleLabel: partial.scheduleLabel ?? 'Lot A - 15-11-2026',
		structureId: partial.structureId ?? 'st1',
		structureName: partial.structureName ?? 'JJJ',
		qty: partial.qty ?? 2,
		unit: partial.unit ?? 'Set',
		weightMt: partial.weightMt ?? 1.5,
		ocrStatus: partial.ocrStatus ?? 'not_verified',
		cpStatus: partial.cpStatus ?? 'none',
		hasPublishedCp: partial.hasPublishedCp ?? false,
		issues: partial.issues ?? [],
		...partial
	};
}

describe('schedule setup labels', () => {
	it('prefixes work order on the project label', () => {
		expect(projectLabel({ workOrderCode: 'WO-1', projectName: 'Alpha' })).toBe('WO-1 Alpha');
		expect(projectLabel({ workOrderCode: '', projectName: 'Alpha' })).toBe('Alpha');
	});
});

describe('buildScheduleSetupTree', () => {
	it('nests BOMs under project → schedule → structure', () => {
		const tree = buildScheduleSetupTree([
			bom({
				id: 'ds1-b1',
				bomId: 'b1',
				bomName: 'Basic Body',
				ocrStatus: 'verified',
				hasPublishedCp: true,
				cpStatus: 'planned'
			}),
			bom({
				id: 'ds1-b2',
				bomId: 'b2',
				bomName: 'Basic Body 2',
				issues: [{ message: 'Missing cutting plan' }]
			})
		]);

		expect(tree).toHaveLength(1);
		expect(tree[0]?.label).toBe('WO-1 Test Project');
		expect(tree[0]?.children).toHaveLength(1);
		expect(tree[0]?.children?.[0]?.label).toBe('Lot A - 15-11-2026');
		expect(tree[0]?.children?.[0]?.children?.[0]?.label).toBe('JJJ');
		expect(tree[0]?.children?.[0]?.children?.[0]?.children?.map((n) => n.label)).toEqual([
			'Basic Body',
			'Basic Body 2'
		]);
		expect(tree[0]?.children?.[0]?.children?.[0]?.children?.[0]?.data).toEqual({
			level: 'bom',
			qty: '2',
			weightMt: 1.5
		});
		expect(tree[0]?.children?.[0]?.children?.[0]?.data?.weightMt).toBe(3);
		expect(tree[0]?.children?.[0]?.data?.weightMt).toBe(3);
		expect(tree[0]?.data?.weightMt).toBe(3);
		expect(tree[0]?.children?.[0]?.children?.[0]?.children?.[1]?.data?.qty).toBe('2');
	});

	it('splits distinct projects and schedules', () => {
		const tree = buildScheduleSetupTree([
			bom({ id: 'ds1-b1', projectId: 'p1', projectName: 'A' }),
			bom({
				id: 'ds2-b2',
				bomId: 'b2',
				projectId: 'p2',
				projectName: 'B',
				scheduleId: 'ds2',
				scheduleLabel: 'Lot B',
				structureId: 'st2',
				structureName: 'Tower'
			})
		]);

		expect(tree.map((n) => n.label)).toEqual(['WO-1 A', 'WO-1 B']);
		expect(tree[1]?.children?.[0]?.label).toBe('Lot B');
		expect(tree[1]?.children?.[0]?.children?.[0]?.label).toBe('Tower');
		expect(tree[1]?.children?.[0]?.children?.[0]?.data?.weightMt).toBe(1.5);
	});
});

describe('scheduleSetupTreeFilterMatch', () => {
	it('matches label and leaf quantity/weight fields', () => {
		const [project] = buildScheduleSetupTree([
			bom({ id: 'ds1-b1', bomName: 'Basic Body', ocrStatus: 'verified' })
		]);
		expect(project).toBeDefined();
		if (!project) return;
		expect(scheduleSetupTreeFilterMatch(project, 'test project')).toBe(true);
		const leaf = project.children?.[0]?.children?.[0]?.children?.[0];
		expect(leaf && scheduleSetupTreeFilterMatch(leaf, '1.50')).toBe(true);
		expect(leaf && scheduleSetupTreeFilterMatch(leaf, 'zzz')).toBe(false);
	});
});
