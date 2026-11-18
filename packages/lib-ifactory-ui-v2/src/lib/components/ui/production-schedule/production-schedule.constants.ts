export type ScheduleTreeNode = {
	id: string;
	label: string;
	children?: ScheduleTreeNode[];
};

export type ScheduleResource = {
	id: string;
	label: string;
	groupId: string;
};

export type ScheduleTask = {
	id: string;
	resourceId: string;
	label: string;
	orderId?: string;
	/** Gantt highlight / tree leaf — `aps_scheduled_tasks.job_card_id` or `unassigned`. */
	jobCardId?: string;
	/** Solver pin token from `aps_scheduled_tasks.metadata.order_id`. */
	pinOrderId?: string;
	/** proj_bom_items primary key — legacy pin fallback only. */
	bomItemId?: string;
	markLabel?: string;
	stepId?: string;
	startMin: number;
	durationMin: number;
	changeoverMin?: number;
	color: string;
	locked?: boolean;
	qty?: number;
	/** Tree node ids this bar should stay highlighted for (section, RMID, markings). */
	highlightIds?: string[];
};

export type ScheduleDetailField = {
	label: string;
	value: string | number;
};

export type ScheduleDetailSection = {
	title: string;
	fields: ScheduleDetailField[];
};

export type ScheduleJobDetail = {
	title: string;
	color: string;
	sections: ScheduleDetailSection[];
	actionLabel?: string;
};

export type UtilizationSeries = {
	id: string;
	label: string;
	color: string;
	points: number[];
	noLoad?: boolean;
};

export type ScheduleChangeImpact = {
	type: 'shift' | 'task-shift' | 'success' | 'failure';
	text: string;
};

export type ScheduleConfirmChange = {
	beforeMachine: string;
	afterMachine: string;
	beforeStart: string;
	beforeEnd: string;
	afterStart: string;
	afterEnd: string;
	changeover: string;
	impacts: ScheduleChangeImpact[];
};
