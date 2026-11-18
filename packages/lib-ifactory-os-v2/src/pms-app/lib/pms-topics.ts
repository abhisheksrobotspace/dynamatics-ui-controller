export const PMS_SUBSCRIBE_TOPICS = {
	JOB_STOPPED: '/iow/jobStopped',
	JOB_RESUMED: '/iow/jobResumed',
	JOB_CANCELLED: '/iow/jobCancelled',
	JOB_COMPLETED: '/iow/jobCompleted',
	/** Manual: a bundle ended — `{ jid, marking, bundleNo, remaining: [{ marking, bundleNo }] }`, before `/iow/jobCompleted`. */
	BUNDLE_COMPLETED: '/iow/bundleCompleted',
	/** The card was parked with tasks left, after its task summary. */
	JOB_PARKED: '/iow/jobParked',
	JOB_REJECTED: '/iow/jobRejected',
	AUTO_ALERT_SELECTED: '/iow/autoAlertSelected',
	JOB_PROGRESS: '/iow/jobProgress',
	MACHINE_SETTINGS: '/iow/machineSettings',
	PART_DETECTED: '/iow/partDetected',
	DECOMMISSIONED: '/iow/decommissioned',
	OPERATOR_SESSION_ENDED: '/iow/operatorSessionEnded'
} as const;

export const PMS_PUBLISH_TOPICS = {
	START_JOB: '/iow/startJob',
	SELECT_RM_ID: '/iow/selectRmId',
	CLOSE_TICKET: '/iow/closeTicket',
	CANCEL_JOB: '/iow/cancelJob',
	END_JOB: '/iow/endJob',
	UPDATE_PARTS_PRODUCED: '/iow/updatePartsProduced',
	JOB_STOPPED: '/iow/jobStopped',
	JOB_RESUMED: '/iow/jobResumed',
	REASON_SELECTED: '/iow/reasonSelected',
	RAISE_ALERT: '/iow/raiseAlert',
	CLIT_COMPLETED: '/iow/clitCompleted',
	CURRENT_SCREEN: '/iow/currentScreen',
	UNLOCK: '/iow/unlock'
} as const;
