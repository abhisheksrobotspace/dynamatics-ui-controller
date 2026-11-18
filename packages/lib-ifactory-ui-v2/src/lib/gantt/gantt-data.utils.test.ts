import { describe, expect, it } from 'vitest';
import {
	configureGanttViewport,
	fitGanttZoomToInitialWindow,
	pairDependencyTasks,
	zoomGanttKeepingView
} from './gantt-data.utils';
import { ganttState } from './state.svelte';
import type { ScheduledJob } from './aps-types';

describe('pairDependencyTasks', () => {
	it('links each successor to the latest predecessor that finished before it', () => {
		const n2605 = { id: 'n-2605', start: 100, end: 140 };
		const n2606 = { id: 'n-114', start: 130, end: 180 };
		const b2605 = { id: 'b-jm96', start: 150, end: 170 };
		const b2606 = { id: 'b-njm14', start: 180, end: 200 };

		const pairs = pairDependencyTasks([n2605, n2606], [b2605, b2606]);

		expect(pairs.map((p) => [p.from.id, p.to.id])).toEqual([
			['n-2605', 'b-jm96'],
			['n-114', 'b-njm14']
		]);
	});

	it('reuses the last predecessor when several successors follow one step', () => {
		const cps = { id: 'cps-last', start: 0, end: 50 };
		const n1 = { id: 'n1', start: 60, end: 80 };
		const n2 = { id: 'n2', start: 90, end: 110 };

		const pairs = pairDependencyTasks([cps], [n1, n2]);

		expect(pairs.map((p) => [p.from.id, p.to.id])).toEqual([
			['cps-last', 'n1'],
			['cps-last', 'n2']
		]);
	});
});

describe('configureGanttViewport', () => {
	const job = (start: number, end: number): ScheduledJob =>
		({
			order_id: 'o',
			order_number: '1',
			product_id: '',
			quantity: 1,
			start,
			end,
			machine_id: 'm1',
			color: '#000'
		}) as ScheduledJob;

	it('starts the axis at the first assigned task', () => {
		const scheduleStart = Date.parse('2025-09-16T18:58:00Z');
		const firstTask = Date.parse('2026-02-28T23:59:00Z');
		const lastTask = Date.parse('2026-03-01T12:00:00Z');

		configureGanttViewport([job(firstTask, lastTask)], scheduleStart);

		expect(ganttState.viewportStart).toBe(firstTask);
		expect(ganttState.viewportEnd).toBeGreaterThan(lastTask);
		expect(ganttState.simulationStartTime).toBe(scheduleStart);
	});

	it('falls back to schedule start when there are no jobs (not Date.now)', () => {
		const scheduleStart = Date.parse('2025-09-16T18:58:00Z');
		configureGanttViewport([], scheduleStart);
		expect(ganttState.viewportStart).toBe(scheduleStart);
	});
});

describe('fitGanttZoomToInitialWindow', () => {
	it('keeps zoom readable even when the full makespan is months long', () => {
		ganttState.viewportStart = 0;
		ganttState.viewportEnd = 240_900 * 60_000; // ~4015h — must not drive zoom
		fitGanttZoomToInitialWindow(8, 1200);
		// 8h into 1200px → 2.5 px/min
		expect(ganttState.zoom).toBe(2.5);
	});
});

describe('zoomGanttKeepingView', () => {
	it('keeps the time at viewport center fixed when zooming', () => {
		ganttState.viewportStart = 0;
		ganttState.viewportEnd = 1000 * 60_000;
		ganttState.zoom = 2;
		const scrollLeft = 400;
		const viewWidth = 800;
		const centerTimeBefore = ganttState.xToTime(scrollLeft + viewWidth / 2);

		const nextScroll = zoomGanttKeepingView(4, { scrollLeft, viewWidth });
		const centerTimeAfter = ganttState.xToTime(nextScroll + viewWidth / 2);

		expect(ganttState.zoom).toBe(4);
		expect(centerTimeAfter).toBeCloseTo(centerTimeBefore, 0);
	});
});
