import { triggerJob, waitForJob, type WaitForJobOptions } from '../../lib/api/jobs.js';
import { currentInvActor } from './inv-actor.js';
import type {
	ApplyUploadResult,
	ApplyToLockResult,
	BuildIndentResult,
	BuildStockMapResult,
	ConfirmLockResult,
	InvActor,
	LockStockResult,
	ReleaseLockResult
} from './inv.types.js';
import { num } from './inv.num.js';
import { toPlanMonthDate } from './plan-month.js';

/** Fast inv reads/writes: first status check ~500ms, then every 1s (not the 10s CP/OCR default). */
export const INV_JOB_POLL_SCHEDULE_MS = [500, 1000];

async function runInvJob<T>(
	request: Record<string, unknown>,
	options?: WaitForJobOptions
): Promise<T> {
	const { job_id } = await triggerJob('inv', request, options?.signal);
	const hasCustomPoll =
		options?.intervalMs != null ||
		(options?.intervalMsSchedule != null && options.intervalMsSchedule.length > 0);
	const job = await waitForJob(job_id, {
		...options,
		...(hasCustomPoll ? {} : { intervalMsSchedule: INV_JOB_POLL_SCHEDULE_MS })
	});
	return job.result_ref as T;
}

export function applyUpload(
	uploadId: string,
	options?: WaitForJobOptions & { actor?: InvActor }
): Promise<ApplyUploadResult> {
	const actor = options?.actor ?? currentInvActor();
	return runInvJob<ApplyUploadResult>(
		{ op: 'apply_upload', upload_id: uploadId, actor },
		options
	).then((result) => ({
		upload_id: result.upload_id,
		already_applied: Boolean(result.already_applied),
		rows_imported: num(result.rows_imported),
		rows_rejected: num(result.rows_rejected),
		rows_warned: result.rows_warned != null ? num(result.rows_warned) : undefined,
		lines_zeroed: num(result.lines_zeroed),
		locks_released: num(result.locks_released),
		projects: Array.isArray(result.projects)
			? result.projects.map((project) => ({
					project_id: String(project.project_id ?? ''),
					name: typeof project.name === 'string' ? project.name : undefined,
					rows: num(project.rows),
					lines_zeroed: num(project.lines_zeroed),
					locks_released: num(project.locks_released),
					rows_without_bom_section:
						project.rows_without_bom_section != null
							? num(project.rows_without_bom_section)
							: undefined
				}))
			: undefined,
		unresolved_projects: Array.isArray(result.unresolved_projects)
			? result.unresolved_projects
			: undefined
	}));
}

/** @deprecated Bar-grained flip — use `lockStock` for the Assign & Lock screen. */
export function confirmLock(
	lockGroup: string,
	confirmedBy: string,
	options?: WaitForJobOptions
): Promise<ConfirmLockResult> {
	return runInvJob<ConfirmLockResult>(
		{ op: 'confirm_lock', lock_group: lockGroup, confirmed_by: confirmedBy },
		options
	).then((result) => ({
		lock_group: result.lock_group,
		locked_bars: num(result.locked_bars),
		short_bars: num(result.short_bars),
		short_refs: Array.isArray(result.short_refs) ? result.short_refs.map(String) : [],
		already_active: Boolean(result.already_active)
	}));
}

export function buildStockMap(
	input: { project_id: string; bom_id: string; sets?: number },
	options?: WaitForJobOptions
): Promise<BuildStockMapResult> {
	return runInvJob<BuildStockMapResult>(
		{
			op: 'build_stock_map',
			project_id: input.project_id,
			bom_id: input.bom_id,
			sets: input.sets ?? 1
		},
		options
	);
}

export function lockStock(
	input: {
		lock_group: string;
		project_id: string;
		month: string;
		delivery_schedule_line_id: string;
		picks: Array<{ stock_line_id: string; qty: number }>;
		central_plan_id?: string;
		actor?: InvActor;
	},
	options?: WaitForJobOptions
): Promise<LockStockResult> {
	const actor = input.actor ?? currentInvActor();
	return runInvJob<LockStockResult>(
		{
			op: 'lock',
			lock_group: input.lock_group,
			project_id: input.project_id,
			month: toPlanMonthDate(input.month),
			delivery_schedule_line_id: input.delivery_schedule_line_id,
			picks: input.picks,
			...(input.central_plan_id ? { central_plan_id: input.central_plan_id } : {}),
			actor
		},
		options
	).then((result) => ({
		lock_group: String(result.lock_group ?? input.lock_group),
		locked_picks: num(result.locked_picks),
		locked_qty: num(result.locked_qty),
		already_locked_picks: num(result.already_locked_picks),
		version: result.version != null ? num(result.version) : undefined
	}));
}

export function releaseLock(
	input: {
		lock_ids?: string[];
		lock_group?: string;
		/** Unlock All — project + month (optionally one DS line). No central_plan_id. */
		scope?: { project_id: string; month: string; delivery_schedule_line_id?: string };
		reason?: string;
		note?: string;
		actor?: InvActor;
	},
	options?: WaitForJobOptions
): Promise<ReleaseLockResult> {
	const actor = input.actor ?? currentInvActor();
	return runInvJob<ReleaseLockResult>(
		{
			op: 'release_lock',
			lock_ids: input.lock_ids,
			lock_group: input.lock_group,
			...(input.scope
				? {
						scope: {
							project_id: input.scope.project_id,
							month: toPlanMonthDate(input.scope.month),
							...(input.scope.delivery_schedule_line_id
								? { delivery_schedule_line_id: input.scope.delivery_schedule_line_id }
								: {})
						}
					}
				: {}),
			reason: input.reason ?? 'manual',
			note: input.note,
			actor
		},
		options
	).then((result) => ({
		released: num(result.released),
		unwound_lines: num(result.unwound_lines),
		already_released: num(result.already_released),
		versions:
			result.versions && typeof result.versions === 'object'
				? (result.versions as Record<string, number>)
				: undefined
	}));
}

export function buildIndent(
	input: {
		project_id: string;
		month: string;
		rows: string[];
		central_plan_id?: string;
		plant_id?: string;
		batch_name?: string;
		excess_pct?: number;
		created_by?: string;
	},
	options?: WaitForJobOptions
): Promise<BuildIndentResult> {
	return runInvJob<BuildIndentResult>(
		{
			op: 'build_indent',
			project_id: input.project_id,
			month: toPlanMonthDate(input.month),
			rows: input.rows,
			...(input.central_plan_id ? { central_plan_id: input.central_plan_id } : {}),
			plant_id: input.plant_id,
			batch_name: input.batch_name,
			excess_pct: input.excess_pct,
			created_by: input.created_by
		},
		options
	);
}

export function reviseIndent(
	input: {
		indent_id: string;
		lines: Array<{
			indent_line_id: string;
			overridden_length_mm?: number | null;
			procure_qty_base?: number;
		}>;
	},
	options?: WaitForJobOptions
): Promise<unknown> {
	return runInvJob(
		{
			op: 'revise_indent',
			indent_id: input.indent_id,
			lines: input.lines
		},
		options
	);
}

export function applyToLock(
	input: {
		run_id: string;
		/** Omit to re-pin every DS line for the run's BOM. */
		delivery_schedule_line_ids?: string[];
	},
	options?: WaitForJobOptions
): Promise<ApplyToLockResult> {
	return runInvJob<ApplyToLockResult>(
		{
			op: 'apply_to_lock',
			run_id: input.run_id,
			...(input.delivery_schedule_line_ids?.length
				? { delivery_schedule_line_ids: input.delivery_schedule_line_ids }
				: {})
		},
		options
	).then((result) => ({
		run_id: String(result.run_id ?? input.run_id),
		published: Boolean(result.published),
		pinned_line_ids: Array.isArray(result.pinned_line_ids)
			? result.pinned_line_ids.map(String)
			: [],
		stale_locks: Array.isArray(result.stale_locks) ? result.stale_locks : [],
		affected_indents: Array.isArray(result.affected_indents) ? result.affected_indents : [],
		warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : []
	}));
}
