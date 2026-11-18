import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { user } from '../../../lib/os/index.svelte.js';
import { planSectionCoversBomSection } from './bom-csv-parser.js';
import { getCorePlanRun } from './cp-plan.api.js';
import type { CpPlanRunRow } from './cp.rows.js';
import { loadBomSectionNames } from './bom-sections.js';

export const CP_ALREADY_PUBLISHED_MESSAGE =
	'A cutting plan version is already published for this BOM.';

export function formatPublishedCpBanner(version: number | null | undefined): string {
	return version != null
		? `Cutting plan v${version} is published for this BOM`
		: 'A cutting plan version is published for this BOM';
}

export function formatAlreadyPublishedCpMessage(version: number | null | undefined): string {
	return version != null
		? `Cutting plan v${version} is already published for this BOM.`
		: CP_ALREADY_PUBLISHED_MESSAGE;
}

export type CpPublishEligibility = {
	canPublish: boolean;
	reason?: string;
	missingSections?: string[];
};

/** Compare BOM base section names to sections covered by a run manifest. */
export function missingSectionsForRun(
	bomSectionNames: string[],
	runSectionNames: string[]
): string[] {
	return bomSectionNames.filter(
		(bomName) => !runSectionNames.some((runName) => planSectionCoversBomSection(bomName, runName))
	);
}

export function assessCpRunPublishEligibility(args: {
	run: Pick<CpPlanRunRow, 'run_id' | 'status' | 'section_plan_ids' | 'sections_planned'>;
	bomSectionNames: string[];
	runSectionNames: string[];
}): CpPublishEligibility {
	if (args.run.status === 'published') {
		return { canPublish: false, reason: 'This run is already published.' };
	}
	if (args.run.status !== 'completed') {
		return { canPublish: false, reason: 'Only completed runs can be published.' };
	}
	if (args.bomSectionNames.length === 0) {
		return { canPublish: false, reason: 'BOM has no sections to plan.' };
	}
	const missing = missingSectionsForRun(args.bomSectionNames, args.runSectionNames);
	if (missing.length > 0) {
		return {
			canPublish: false,
			reason: `Run is missing ${missing.length} section(s): ${missing.join(', ')}.`,
			missingSections: missing
		};
	}
	return { canPublish: true };
}

async function listSectionNamesForPlanIds(
	sectionPlanIds: string[],
	signal?: AbortSignal
): Promise<string[]> {
	if (sectionPlanIds.length === 0) return [];
	const idList = sectionPlanIds.map((id) => encodeURIComponent(id)).join(',');
	const envelope = await apiClient.get<ApiEnvelope<Array<{ section: string }>>>(
		apiClient.datahub(`cp_section_plans?limit=2500&section_plan_id__in=${idList}&select=section`),
		{ signal }
	);
	return rowsFromEnvelope(envelope.data).map((row) => row.section);
}

async function resolveRunSectionNames(
	run: Pick<CpPlanRunRow, 'run_id' | 'bom_id' | 'section_plan_ids' | 'sections_planned'>,
	bomId: string,
	signal?: AbortSignal
): Promise<string[]> {
	const fromRun = (run.sections_planned ?? []).map((name) => name.trim()).filter(Boolean);
	if (fromRun.length > 0) return fromRun;

	let sectionPlanIds = run.section_plan_ids ?? [];
	if (sectionPlanIds.length === 0) {
		const header = await getCorePlanRun(bomId, run.run_id);
		sectionPlanIds = header?.section_plan_ids ?? [];
		const fromHeader = (header?.sections_planned ?? []).map((name) => name.trim()).filter(Boolean);
		if (fromHeader.length > 0) return fromHeader;
	}

	return listSectionNamesForPlanIds(sectionPlanIds, signal);
}

type PublishedCpRunHeader = {
	run_id: string;
	bom_id: string;
	version: number;
	published_at?: string | null;
	published_by?: string | null;
};

const PUBLISHED_CP_RUN_SELECT = 'run_id,bom_id,version,published_at,published_by';

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

/** Keep `__in=` query strings under proxy/header limits (HTTP 431). */
function chunkIds(ids: string[], maxEncodedLen = 2500): string[][] {
	const unique = [...new Set(ids.filter(Boolean))];
	const chunks: string[][] = [];
	let current: string[] = [];
	let encodedLen = 0;
	for (const id of unique) {
		const piece = encodeURIComponent(id);
		const next = encodedLen === 0 ? piece.length : encodedLen + 1 + piece.length;
		if (current.length > 0 && next > maxEncodedLen) {
			chunks.push(current);
			current = [];
			encodedLen = 0;
		}
		current.push(id);
		encodedLen = encodedLen === 0 ? piece.length : encodedLen + 1 + piece.length;
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

/** Canonical publish marker: `cp_plan_runs.status = published`. */
async function getPublishedCpRunHeader(
	bomId: string,
	signal?: AbortSignal
): Promise<PublishedCpRunHeader | null> {
	const envelope = await apiClient.get<ApiEnvelope<PublishedCpRunHeader[]>>(
		apiClient.datahub(
			`cp_plan_runs?bom_id=${encodeURIComponent(bomId)}&status=published&select=${PUBLISHED_CP_RUN_SELECT}&limit=1`
		),
		{ signal }
	);
	const row = rowsFromEnvelope(envelope.data)[0];
	return row?.run_id ? row : null;
}

/** Map bom_id → published run (one published run per BOM). */
export async function listPublishedCpByBomIds(
	bomIds: string[],
	signal?: AbortSignal
): Promise<Map<string, { runId: string; version: number }>> {
	const byBomId = new Map<string, { runId: string; version: number }>();
	if (bomIds.length === 0) return byBomId;

	for (const chunk of chunkIds(bomIds)) {
		const envelope = await apiClient.get<ApiEnvelope<PublishedCpRunHeader[]>>(
			apiClient.datahub(
				`cp_plan_runs?status=published&bom_id__in=${idListParam(chunk)}&select=${PUBLISHED_CP_RUN_SELECT}&limit=5000`
			),
			{ signal }
		);
		for (const row of rowsFromEnvelope(envelope.data)) {
			if (!row.run_id || !row.bom_id) continue;
			byBomId.set(row.bom_id, { runId: row.run_id, version: row.version });
		}
	}
	return byBomId;
}

export async function getPublishedCpRunId(
	bomId: string,
	signal?: AbortSignal
): Promise<string | null> {
	const header = await getPublishedCpRunHeader(bomId, signal);
	return header?.run_id ?? null;
}

export async function getPublishedCpVersion(
	bomId: string,
	signal?: AbortSignal
): Promise<number | null> {
	const header = await getPublishedCpRunHeader(bomId, signal);
	if (!header) return null;
	return Number.isFinite(header.version) ? header.version : null;
}

/** One published-run lookup for both id + version (avoids twin GETs). */
export async function getPublishedCpRun(
	bomId: string,
	signal?: AbortSignal
): Promise<{ runId: string; version: number } | null> {
	const header = await getPublishedCpRunHeader(bomId, signal);
	if (!header?.run_id) return null;
	return {
		runId: header.run_id,
		version: Number.isFinite(header.version) ? header.version : 0
	};
}

/**
 * Publish eligibility for many runs — loads BOM section names once (not once per run).
 * Uses a slim `proj_bom_items?select=section` fetch (no mark/weight payload).
 */
export async function loadCpRunsPublishEligibility(
	bomId: string,
	runs: CpPlanRunRow[],
	signal?: AbortSignal
): Promise<Map<string, CpPublishEligibility>> {
	const out = new Map<string, CpPublishEligibility>();
	if (runs.length === 0) return out;

	const { sectionNames: bomSectionNames, error } = await loadBomSectionNames(bomId, signal);
	if (error) {
		for (const run of runs) {
			out.set(run.run_id, { canPublish: false, reason: error });
		}
		return out;
	}

	await Promise.all(
		runs.map(async (run) => {
			try {
				const runSectionNames = await resolveRunSectionNames(run, bomId, signal);
				out.set(
					run.run_id,
					assessCpRunPublishEligibility({
						run,
						bomSectionNames,
						runSectionNames
					})
				);
			} catch (err) {
				out.set(run.run_id, {
					canPublish: false,
					reason: err instanceof Error ? err.message : 'Eligibility check failed'
				});
			}
		})
	);
	return out;
}

export async function loadCpRunPublishEligibility(
	bomId: string,
	run: CpPlanRunRow,
	signal?: AbortSignal
): Promise<CpPublishEligibility> {
	const map = await loadCpRunsPublishEligibility(bomId, [run], signal);
	return map.get(run.run_id) ?? { canPublish: false, reason: 'Eligibility check failed' };
}

export async function publishCpRun(
	bomId: string,
	run: Pick<CpPlanRunRow, 'run_id' | 'version'>,
	signal?: AbortSignal
): Promise<void> {
	const header = await getCorePlanRun(bomId, run.run_id, signal);
	if (!header) {
		throw new Error('Cutting plan run not found.');
	}

	const publishedRunId = await getPublishedCpRunId(bomId, signal);
	if (publishedRunId) {
		throw new Error(CP_ALREADY_PUBLISHED_MESSAGE);
	}

	const eligibility = await loadCpRunPublishEligibility(bomId, header, signal);
	if (!eligibility.canPublish) {
		throw new Error(eligibility.reason ?? 'This run cannot be published.');
	}

	const now = new Date().toISOString();
	const publishedBy = (user.email ?? '').trim() || 'unknown';

	await apiClient.patch(
		apiClient.datahub(`cp_plan_runs/${encodeURIComponent(header.run_id)}`),
		{
			status: 'published',
			published_at: now,
			published_by: publishedBy
		},
		{ signal }
	);
}
