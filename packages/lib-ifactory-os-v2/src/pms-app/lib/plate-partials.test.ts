import { describe, expect, it } from 'vitest';
import {
	donePlateMarkKeys,
	doneRmKeys,
	plateMarkIsDone,
	plateMarkPieces,
	rmIsDone
} from './jobs.js';

const parked = {
	'job-1': {
		jobId: 'job-1',
		card: { jobId: 'job-1' },
		progress: {
			marks: [
				{ marking: 'A', planned: 2, pieces: 2, done: true },
				{ marking: 'B', planned: 4, pieces: 1, done: false }
			]
		}
	}
};

describe('parked plate marks', () => {
	it('hides only marks the controller marked done', () => {
		const done = donePlateMarkKeys(parked);
		expect(done).toEqual(['job-1::A']);
		expect(plateMarkIsDone(done, 'job-1', 'A')).toBe(true);
		expect(plateMarkIsDone(done, 'job-1', 'B')).toBe(false);
	});

	it('keeps plates already clamped, including the open mark', () => {
		expect(plateMarkPieces(parked)).toEqual({
			'job-1::A': 2,
			'job-1::B': 1
		});
	});

	it('hides angle RMs the controller marked done', () => {
		const parked = {
			'job-1': {
				progress: {
					rms: {
						'RM-1': { done: true },
						'RM-2': { done: false }
					}
				}
			}
		};
		const done = doneRmKeys(parked);
		expect(done).toEqual(['job-1::RM-1']);
		expect(rmIsDone(done, 'job-1', 'RM-1')).toBe(true);
		expect(rmIsDone(done, 'job-1', 'RM-2')).toBe(false);
	});

	it('ignores a runtime error payload', () => {
		expect(donePlateMarkKeys({ error: 'missing' })).toEqual([]);
		expect(plateMarkPieces({ error: 'missing' })).toEqual({});
	});
});
