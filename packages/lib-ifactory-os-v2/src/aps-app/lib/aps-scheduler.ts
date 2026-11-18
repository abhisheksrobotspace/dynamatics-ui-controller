/** Solver strategies supported by aps-orchestrator / aps-solver. */
export type ApsSolverType =
	| 'priority'
	| 'makespan'
	| 'deadline'
	| 'greedy-forward'
	| 'greedy-backward'
	| 'mcts-forward'
	| 'mcts-backward'
	| 'constraint-backward';

export const DEFAULT_APS_SOLVER: ApsSolverType = 'greedy-forward';

/** Review Input / scheduler UI — subset exposed to planners today. */
export const APS_SCHEDULER_UI_OPTIONS = [
	{ value: 'greedy-forward' as const, label: 'Earliest Start' },
	{ value: 'greedy-backward' as const, label: 'Latest Finish' }
];

export type ApsSchedulerUiSolver = (typeof APS_SCHEDULER_UI_OPTIONS)[number]['value'];

export function apsSchedulerLabel(solver: string): string {
	return APS_SCHEDULER_UI_OPTIONS.find((option) => option.value === solver)?.label ?? solver;
}
