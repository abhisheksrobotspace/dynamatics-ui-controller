import type { PmsLine } from './types';
import StartJob from '../routes/angle/StartJob.svelte';
import StoppageReasons from '../routes/angle/StoppageReasons.svelte';
import StoppedDetail from '../routes/angle/StoppedDetail.svelte';
import JobComplete from '../routes/angle/JobComplete.svelte';
import JobRunning from '../routes/angle/JobRunning.svelte';
import JobCard from '../routes/angle/JobCardDetail.svelte';
import JobCardDrawings from '../routes/angle/JobCardDrawings.svelte';

export const line: PmsLine = {
	id: 'angle',
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
