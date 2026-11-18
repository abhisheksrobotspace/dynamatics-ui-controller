/**
 * APS Runs home — schedule requests that have at least one `aps_schedule_runs` row.
 */
import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load.js';
import { rememberManufacturingPlanLabel } from '../../aps-app/lib/manufacturing-plans.js';
import { scheduleRunsHash } from '../../aps-app/lib/schedule-runs.js';
import {
	listScheduleRequests,
	scheduleRequestLabel,
	type ApsScheduleRequestRow
} from '../../aps-app/lib/schedule-requests.api.js';

export type ApsRunsPlanRow = {
	id: string;
	shopfloorPlanId: string;
	name: string;
	month: string;
	monthLabel: string;
	status: string;
	runCount: number;
	latestVersion: number | null;
	latestRunId: string | null;
	latestStatus: string | null;
	sourcesFrozen: boolean | null;
};

type ScheduleRunAgg = {
	request_id: string;
	run_id: string;
	version?: number | null;
	status?: string | null;
	sources_frozen?: boolean | null;
	created_at?: string | null;
};

export async function listApsRunsPlans(signal?: AbortSignal): Promise<ApsRunsPlanRow[]> {
	const [requests, envelope] = await Promise.all([
		listScheduleRequests(undefined, signal),
		apiClient.get<ApiEnvelope<ScheduleRunAgg[]>>(
			apiClient.datahub(
				'aps_schedule_runs?select=request_id,run_id,version,status,sources_frozen,created_at&orderBy=created_at:desc&limit=5000'
			),
			{ signal }
		)
	]);
	const runs = rowsFromEnvelope<ScheduleRunAgg>(envelope.data);
	const byRequest = new Map<string, { count: number; latest: ScheduleRunAgg }>();
	for (const run of runs) {
		const requestId = run.request_id?.trim();
		if (!requestId) continue;
		const existing = byRequest.get(requestId);
		if (!existing) {
			byRequest.set(requestId, { count: 1, latest: run });
			continue;
		}
		existing.count += 1;
		const existingVer = Number(existing.latest.version) || 0;
		const nextVer = Number(run.version) || 0;
		if (nextVer > existingVer) existing.latest = run;
	}

	const requestById = new Map(requests.map((row) => [row.request_id, row]));
	const rows: ApsRunsPlanRow[] = [];

	for (const [requestId, agg] of byRequest) {
		const request: ApsScheduleRequestRow | undefined = requestById.get(requestId);
		const name = request ? scheduleRequestLabel(request) : requestId;
		const month = request?.horizon_start?.slice(0, 7) ?? '';
		const monthLabel = month ? formatMonthLabel(month) : '—';
		rememberManufacturingPlanLabel(requestId, name);
		rows.push({
			id: requestId,
			shopfloorPlanId: requestId,
			name,
			month,
			monthLabel,
			status: request?.status ?? '—',
			runCount: agg.count,
			latestVersion:
				agg.latest.version != null && Number.isFinite(Number(agg.latest.version))
					? Number(agg.latest.version)
					: null,
			latestRunId: agg.latest.run_id ?? null,
			latestStatus: agg.latest.status ?? null,
			sourcesFrozen:
				typeof agg.latest.sources_frozen === 'boolean' ? agg.latest.sources_frozen : null
		});
	}

	// Also list draft requests with no runs yet.
	for (const request of requests) {
		if (byRequest.has(request.request_id)) continue;
		const name = scheduleRequestLabel(request);
		const month = request.horizon_start?.slice(0, 7) ?? '';
		rememberManufacturingPlanLabel(request.request_id, name);
		rows.push({
			id: request.request_id,
			shopfloorPlanId: request.request_id,
			name,
			month,
			monthLabel: month ? formatMonthLabel(month) : '—',
			status: request.status,
			runCount: 0,
			latestVersion: null,
			latestRunId: null,
			latestStatus: null,
			sourcesFrozen: null
		});
	}

	rows.sort((a, b) => {
		const byMonth = b.month.localeCompare(a.month);
		if (byMonth !== 0) return byMonth;
		return a.name.localeCompare(b.name);
	});
	return rows;
}

export function apsRunsPlanHash(requestId: string): string {
	return scheduleRunsHash(requestId);
}
