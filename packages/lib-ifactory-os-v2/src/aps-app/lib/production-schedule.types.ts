import type {
	ScheduleConfirmChange,
	ScheduleJobDetail,
	ScheduleResource,
	ScheduleTask,
	ScheduleTreeNode,
	UtilizationSeries
} from '@ifactory/ui-v2';

export type ScheduleDependencyEdge = {
	from: string;
	to: string;
};

export type ProductionScheduleData = {
	planId: string;
	runId: string;
	version?: number;
	runType?: 'schedule' | 'replan';
	releaseLabel: string;
	/** ISO timestamp when this run was published; null if still draft. */
	publishedAt: string | null;
	publishedBy: string | null;
	/** True when run.published_at is set or any live card is `published`. */
	isPublished?: boolean;
	/** False = draft months were in scope; publish is refused (§6). */
	sourcesFrozen: boolean;
	startLabel: string;
	makespanLabel: string;
	taskCount: number;
	/** Absolute schedule anchor ISO (from `aps_plan_runs.schedule_start`). */
	scheduleStartIso: string;
	timelineStart: string;
	timelineHours: string[];
	currentTimeMin: number;
	timelineSpanMin: number;
	orderTree: ScheduleTreeNode[];
	resources: ScheduleResource[];
	tasks: ScheduleTask[];
	/** Mark process-flow edges (node_id → node_id), e.g. s0→s1 for CPS→Notching. */
	dependencyEdges: ScheduleDependencyEdge[];
	defaultSelectedMarkId: string;
	jobDetailsByMarkId: Record<string, ScheduleJobDetail>;
	jobDetailsByTaskId: Record<string, ScheduleJobDetail>;
	utilization: UtilizationSeries[];
	confirmChange: ScheduleConfirmChange;
	incompatibleResources: string[];
};

export function productionScheduleHash(planId: string): string {
	return `#/ShopFloorPlanning/Aps/${encodeURIComponent(planId)}/ProductionSchedule`;
}
