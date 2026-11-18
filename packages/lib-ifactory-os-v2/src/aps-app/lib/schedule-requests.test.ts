import { describe, expect, it } from 'vitest';
import { requestHasDraftSources, scheduleRequestLabel } from './schedule-requests.api.js';

describe('scheduleRequestLabel', () => {
	it('prefers the request name', () => {
		expect(
			scheduleRequestLabel({ name: 'Weekly p-1', plant_id: 'p-1', horizon_start: '2026-09-01' })
		).toBe('Weekly p-1');
	});

	it('falls back to plant · month', () => {
		expect(scheduleRequestLabel({ name: null, plant_id: 'p-1', horizon_start: '2026-09-01' })).toBe(
			'p-1 · Sep 2026'
		);
	});
});

describe('requestHasDraftSources', () => {
	it('is false when every selected month is frozen', () => {
		expect(
			requestHasDraftSources([
				{ status: 'frozen', selected: true },
				{ status: 'draft', selected: false }
			])
		).toBe(false);
	});

	it('is true when a selected month is still a draft', () => {
		expect(requestHasDraftSources([{ status: 'draft', selected: true }])).toBe(true);
	});
});
