import { describe, expect, it } from 'vitest';
import { getTimelineTicks, visiblePixelWindow } from './timeline.utils';

describe('getTimelineTicks', () => {
	it('does not stack an off-grid start label on top of the next interval tick', () => {
		// First task at 23:59; 15-min grid would also emit 00:00 one minute later.
		const viewportStart = Date.parse('2026-02-28T23:59:00Z');
		const viewportEnd = Date.parse('2026-03-01T01:00:00Z');
		const zoom = 10; // 15-min interval (min gap 100px → 10 min at this zoom picks 15)

		const ticks = getTimelineTicks(viewportStart, viewportEnd, zoom);
		const labels = ticks.map((t) => t.label);

		expect(labels.some((l) => l.includes('23:59'))).toBe(false);
		expect(ticks.length).toBeGreaterThan(0);
		for (let i = 1; i < ticks.length; i += 1) {
			expect(ticks[i]!.x - ticks[i - 1]!.x).toBeGreaterThanOrEqual(100);
		}
	});

	it('culls ticks to the visible pixel window on long makespans', () => {
		const viewportStart = Date.parse('2026-01-01T00:00:00Z');
		const viewportEnd = Date.parse('2026-09-01T00:00:00Z'); // ~8 months
		const zoom = 10; // fine 15-min ticks — full range would be huge
		const visible = visiblePixelWindow(0, 1200, 0);
		const ticks = getTimelineTicks(viewportStart, viewportEnd, zoom, visible);
		expect(ticks.length).toBeGreaterThan(0);
		expect(ticks.length).toBeLessThan(50);
		expect(ticks.every((t) => t.x >= visible.xMin - 1 && t.x <= visible.xMax + 1)).toBe(true);
	});
});
