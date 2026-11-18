import type { ActiveJob } from './job-types';

/** Fallback active-job shape for angle screens when live state is empty. */
export const DEFAULT_ACTIVE_JOB: ActiveJob = {
	jobId: '80496985-HAE350AF45X45X4-7-10000',
	section: '75x75x6',
	rmLength: '10000',
	rmId: 'RM-10000-0142',
	runRmIds: ['RM-10000-0142'],
	piecesCut: 4,
	piecesPlanned: 40,
	barsCompleted: 1,
	barsPlanned: 5,
	completePercent: 10,
	startTimeLabel: '1:40 PM',
	marks: [
		{
			id: 'TA4195DA1007',
			pcsPerBar: 5,
			operations: 4,
			pcs: 4,
			partLength: 1767,
			progressCurrent: 5,
			progressTotal: 20,
			produced: 20
		},
		{
			id: 'TA4195DA1012',
			pcsPerBar: 4,
			operations: 3,
			pcs: 5,
			partLength: 1450,
			progressCurrent: 4,
			progressTotal: 16,
			produced: 16
		},
		{
			id: 'TA4195DA1019',
			pcsPerBar: 6,
			operations: 4,
			pcs: 3,
			partLength: 2140,
			progressCurrent: 6,
			progressTotal: 24,
			produced: 24
		}
	]
};

export const STOPPED_JOB: ActiveJob = {
	...DEFAULT_ACTIVE_JOB,
	section: 'ISA 75x75x6',
	piecesCut: 15,
	piecesPlanned: 60,
	barsCompleted: 1,
	barsPlanned: 4,
	completePercent: 25
};
