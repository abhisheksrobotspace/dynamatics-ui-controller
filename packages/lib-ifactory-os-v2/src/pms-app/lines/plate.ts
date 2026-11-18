import type { PmsLine } from './types';
import StartJob from '../routes/plate/StartJob.svelte';
import StoppageReasons from '../routes/plate/StoppageReasons.svelte';
import StoppedDetail from '../routes/plate/StoppedDetail.svelte';
import JobComplete from '../routes/plate/JobComplete.svelte';
import JobRunning from '../routes/plate/JobRunning.svelte';
import JobCard from '../routes/angle/JobCardDetail.svelte';
import JobCardDrawings from '../routes/angle/JobCardDrawings.svelte';

export const line: PmsLine = {
	id: 'plate',
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
