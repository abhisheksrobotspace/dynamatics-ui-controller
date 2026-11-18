import type { PmsLine } from './types';
import StartJob from '../routes/manual/StartJob.svelte';
import StoppageReasons from '../routes/manual/StoppageReasons.svelte';
import StoppedDetail from '../routes/manual/StoppedDetail.svelte';
import JobComplete from '../routes/manual/JobComplete.svelte';
import JobRunning from '../routes/manual/JobRunning.svelte';
import JobCard from '../routes/angle/JobCardDetail.svelte';
import JobCardDrawings from '../routes/angle/JobCardDrawings.svelte';

export const line: PmsLine = {
	id: 'manual',
	screens: {
		StartJob,
		StoppageReasons,
		StoppedDetail,
		JobComplete,
		JobRunning,
		JobCard,
		JobCardDrawings
	}
};
