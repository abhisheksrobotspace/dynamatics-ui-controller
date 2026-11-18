/**
 * Base URL for the cutting plan solver API.
 * Dev: leave unset — Vite proxies `/api/plan` to `VITE_PLANNER_PROXY_TARGET` (default http://127.0.0.1:8000).
 * Prod: set `VITE_PLANNER_API_BASE` at build time.
 */
export const PLANNER_API_BASE = import.meta.env.VITE_PLANNER_API_BASE ?? '';

export const CUTTING_PLAN_DRAFT_KEY = (bomId: string) => `cutting-plan-draft-${bomId}`;
export const CUTTING_PLAN_RESULT_KEY = (bomId: string) => `cutting-plan-result-${bomId}`;
export const CUTTING_PLAN_RUNS_KEY = (bomId: string) => `cutting-plan-runs-${bomId}`;
/** Hard ceiling for time_limit per section (seconds), independent of section count. */
export const MAX_TIME_LIMIT_PER_SECTION_SECONDS = 5;

/** Max seconds allowed for `time_limit` per section in planner settings. */
export function maxTimeLimitPerSection(): number {
	return MAX_TIME_LIMIT_PER_SECTION_SECONDS;
}

/** Used when a project has no saved planner settings yet. */
export const DEFAULT_PLANNER_SETTINGS = {
	timeLimit: 1,
	maxUniqueLengthsPerBar: 4,
	maxUniqueStockLengthsPerSection: 3,
	enforceMarkCohesion: true
} as const;

/** Seeded when a project has no section rules configured yet. */
export const DEFAULT_SECTION_RULES = [
	{
		fromFlg: 1,
		toFlg: 150,
		fromThk: 1,
		toThk: 12,
		minLength: 6000,
		maxLength: 12000,
		endTrim: 100,
		pitch: 25
	},
	{
		fromFlg: 150,
		toFlg: 300,
		fromThk: 13,
		toThk: 30,
		minLength: 6000,
		maxLength: 12000,
		endTrim: 75,
		pitch: 25
	}
] as const;
