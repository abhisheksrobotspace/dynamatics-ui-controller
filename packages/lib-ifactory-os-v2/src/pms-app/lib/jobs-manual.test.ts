import { describe, expect, it } from 'vitest';
import {
	jobHasAvailableMarkings,
	manualHoleProgress,
	manualRowKey,
	manualTaskKey,
	manualTaskProgress,
	parseJobsMap,
	unfinishedManualMarks
} from './jobs.js';

describe('manual card rows', () => {
	it('keeps every marking when bundle numbers repeat', () => {
		const jobs = parseJobsMap({
			'job-1': {
				jobId: 'job-1',
				cardType: 'manual',
				scheduledAt: '2026-08-29T04:00:00.000Z',
				dueAt: '2026-08-29T18:00:00.000Z',
				marks: [
					{ marking: 'J57', itemLength: 1767, pcs: 6, bundleNo: 1, weightPerPieceKg: 28.53 },
					{ marking: 'J58', itemLength: 900, pcs: 10, bundleNo: 1, weightPerPieceKg: 12.4 },
					{ marking: 'J57', itemLength: 1767, pcs: 2, bundleNo: 2, weightPerPieceKg: 28.53 }
				]
			}
		});
		const marks = jobs['job-1']?.manualMarks ?? [];
		expect(marks.map((mark) => manualRowKey(mark.marking, mark.bundleNo)).sort()).toEqual(
			[manualRowKey('J57', 1), manualRowKey('J57', 2), manualRowKey('J58', 1)].sort()
		);
		expect(marks.find((mark) => mark.marking === 'J58')).toMatchObject({
			bundleNo: 1,
			pcs: 10
		});
		expect(jobs['job-1']?.bars).toEqual({});
	});
});

describe('parked manual bundles', () => {
	const card = {
		jobId: 'job-1',
		cardType: 'manual',
		scheduledAt: '2026-08-29T04:00:00.000Z',
		dueAt: '2026-08-29T18:00:00.000Z',
		marks: [
			{ marking: 'J57', itemLength: 1767, pcs: 6, bundleNo: 1, weightPerPieceKg: 28.53 },
			{ marking: 'J57', itemLength: 1767, pcs: 2, bundleNo: 2, weightPerPieceKg: 28.53 },
			{ marking: 'J58', itemLength: 900, pcs: 10, bundleNo: 1, weightPerPieceKg: 12.4 }
		]
	};
	const parked = {
		'job-1': {
			jobId: 'job-1',
			parkedAt: 1793098957000,
			progress: {
				tasks: [
					{ marking: 'J57', bundleNo: 1, planned: 6, operations: 24, done: true },
					{ marking: 'J57', bundleNo: 2, planned: 2, operations: 3, done: false },
					{ marking: 'J58', bundleNo: 1, planned: 10, operations: 0, done: false }
				]
			}
		}
	};

	it('reads each bundle of a parked card by marking and bundle number', () => {
		expect(manualTaskProgress(parked)).toEqual({
			[manualTaskKey('job-1', 'J57', 1)]: { operations: 24, done: true },
			[manualTaskKey('job-1', 'J57', 2)]: { operations: 3, done: false },
			[manualTaskKey('job-1', 'J58', 1)]: { operations: 0, done: false }
		});
		expect(manualTaskProgress({ error: 'not found' })).toEqual({});
	});

	it('offers only bundles that are not finished', () => {
		const job = parseJobsMap({ 'job-1': card })['job-1']!;
		const tasks = manualTaskProgress(parked);
		expect(
			unfinishedManualMarks(job, tasks).map((mark) => manualRowKey(mark.marking, mark.bundleNo))
		).toEqual([manualRowKey('J57', 2), manualRowKey('J58', 1)]);
		expect(jobHasAvailableMarkings(job, undefined, undefined, tasks)).toBe(true);
	});

	it('has nothing to start once every bundle is finished', () => {
		const job = parseJobsMap({ 'job-1': card })['job-1']!;
		const allDone = manualTaskProgress({
			'job-1': {
				progress: {
					tasks: card.marks.map(({ marking, bundleNo, pcs }) => ({
						marking,
						bundleNo,
						planned: pcs,
						operations: pcs,
						done: true
					}))
				}
			}
		});
		expect(unfinishedManualMarks(job, allDone)).toEqual([]);
		expect(jobHasAvailableMarkings(job, undefined, undefined, allDone)).toBe(false);
	});

	it('sums a row repeated for the same bundle, as the controller does', () => {
		const job = parseJobsMap({
			'job-1': {
				...card,
				marks: [
					{ marking: 'J57', itemLength: 1767, pcs: 6, bundleNo: 1, weightPerPieceKg: 28.53 },
					{ marking: 'J57', itemLength: 1767, pcs: 4, bundleNo: 1, weightPerPieceKg: 28.53 }
				]
			}
		})['job-1']!;
		expect(job.manualMarks).toHaveLength(1);
		expect(job.manualMarks?.[0]?.pcs).toBe(10);
	});
});

describe('manual hole count', () => {
	const job = (operations: number | undefined, holes: number) => ({
		operationsCount: holes,
		piecesPlanned: 8,
		marks: [{ operations, progressTotal: 8 }]
	});

	it('plans in holes when the bundle has operations per piece', () => {
		expect(manualHoleProgress(job(4, 0))).toEqual({
			holes: 0,
			plannedLabel: 'Planned Holes',
			planned: 32,
			tone: 'muted'
		});
		expect(manualHoleProgress(job(4, 10)).tone).toBe('primary');
		expect(manualHoleProgress(job(4, 32)).tone).toBe('success');
	});

	it('falls back to the planned pieces without operations per piece, and is not grey once holes are made', () => {
		expect(manualHoleProgress(job(undefined, 0))).toEqual({
			holes: 0,
			plannedLabel: 'Planned Qty',
			planned: 8,
			tone: 'muted'
		});
		expect(manualHoleProgress(job(undefined, 46)).tone).toBe('primary');
	});
});
