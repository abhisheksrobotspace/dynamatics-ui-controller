import { describe, expect, it } from 'vitest';
import { dueDatePatchesFromDiff, mergePlanLinkDueDates } from './create-plan-due-dates.js';
import { resolveDueDate, validateDueDateDraft } from './due-dates.js';

describe('due-dates helpers', () => {
	it('resolveDueDate picks first non-empty candidate', () => {
		expect(resolveDueDate(['2026-01-01', '2026-02-02'])).toBe('2026-01-01');
		expect(resolveDueDate([null, undefined, '  ', '2026-03-03'])).toBe('2026-03-03');
		expect(resolveDueDate([])).toBeNull();
	});

	it('mergePlanLinkDueDates applies link due dates to matching releases', () => {
		const projects = mergePlanLinkDueDates(
			[
				{
					id: 'p1',
					title: 'P1',
					subtitle: '',
					workOrderCode: 'J1',
					releases: [{ id: 'r1', projectId: 'p1' } as never]
				}
			],
			[{ production_plan_id: 'r1', due_date: '2026-07-15T00:00:00+05:30' }]
		);
		expect(projects[0]?.releases[0]?.dueDate).toBe('2026-07-15T00:00:00+05:30');
	});

	it('dueDatePatchesFromDiff returns only changed ids', () => {
		const initial = new Map([
			['s1', null],
			['b1', '2026-01-01T00:00:00Z']
		]);
		const current = new Map([
			['s1', '2026-02-01T00:00:00Z'],
			['b1', '2026-01-01T00:00:00Z']
		]);
		expect(dueDatePatchesFromDiff(current, initial)).toEqual([['s1', '2026-02-01T00:00:00Z']]);
	});

	it('validateDueDateDraft rejects invalid input', () => {
		expect(validateDueDateDraft('', { required: true })).toBe('Enter a due date.');
		expect(validateDueDateDraft('not-a-date')).toBe('Enter a valid due date (DD/MM/YYYY).');
	});
});
