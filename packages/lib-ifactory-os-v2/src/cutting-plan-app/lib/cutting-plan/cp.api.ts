import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import type {
	LengthGroup,
	PlannerSettings,
	SectionRule
} from '../../../project-management-app/lib/store.svelte.js';
import { DEFAULT_SECTION_RULES } from './constants.js';
import type { CpLengthGroupRow, CpPlannerSettingsRow, CpSectionRuleRow } from './cp.rows.js';

/** Coerce a datahub `numeric` (which may arrive as a string) to `number | null`. */
function num(value: number | string | null | undefined): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

// ── cp_section_rules ────────────────────────────────────────────────────────────────────────

function mapSectionRuleRow(row: CpSectionRuleRow): SectionRule {
	return {
		id: row.rule_id,
		projectId: row.project_id,
		fromFlg: num(row.from_flg_mm),
		toFlg: num(row.to_flg_mm),
		fromThk: num(row.from_thk_mm),
		toThk: num(row.to_thk_mm),
		minLength: num(row.min_length_mm),
		maxLength: num(row.max_length_mm),
		endTrim: num(row.end_trim_mm),
		pitch: num(row.pitch_mm)
	};
}

/** Column body for create/update. `id`/`projectId` are addressed separately. */
function sectionRuleBody(rule: SectionRuleInput): Record<string, unknown> {
	return {
		from_flg_mm: rule.fromFlg,
		to_flg_mm: rule.toFlg,
		from_thk_mm: rule.fromThk,
		to_thk_mm: rule.toThk,
		min_length_mm: rule.minLength,
		max_length_mm: rule.maxLength,
		end_trim_mm: rule.endTrim,
		pitch_mm: rule.pitch
	};
}

export type SectionRuleInput = Omit<SectionRule, 'id' | 'projectId'>;

export async function listSectionRules(
	projectId: string,
	signal?: AbortSignal
): Promise<SectionRule[]> {
	const envelope = await apiClient.get<ApiEnvelope<CpSectionRuleRow[]>>(
		apiClient.datahub(
			`cp_section_rules?limit=2500&project_id=${encodeURIComponent(projectId)}&orderBy=sort_order:asc`
		),
		{ signal }
	);
	return rowsFromEnvelope<CpSectionRuleRow>(envelope.data).map(mapSectionRuleRow);
}

const seedSectionRulesInFlight = new Map<string, Promise<void>>();

/**
 * Existence check for BOM list gating. When the project has no section rules yet,
 * seeds {@link DEFAULT_SECTION_RULES} and returns true. Concurrent calls for the
 * same project share one in-flight seed.
 */
export async function hasSectionRules(projectId: string, signal?: AbortSignal): Promise<boolean> {
	const inFlight = seedSectionRulesInFlight.get(projectId);
	if (inFlight) {
		await inFlight;
		return true;
	}

	const promise = (async () => {
		const envelope = await apiClient.get<ApiEnvelope<Array<{ rule_id: string }>>>(
			apiClient.datahub(
				`cp_section_rules?project_id=${encodeURIComponent(projectId)}&limit=1&select=rule_id`
			),
			{ signal }
		);
		if (rowsFromEnvelope(envelope.data).length > 0) return;

		for (let index = 0; index < DEFAULT_SECTION_RULES.length; index++) {
			const rule = DEFAULT_SECTION_RULES[index] as SectionRuleInput;
			await createSectionRule(projectId, rule, index, signal);
		}
	})().finally(() => {
		seedSectionRulesInFlight.delete(projectId);
	});

	seedSectionRulesInFlight.set(projectId, promise);
	await promise;
	return true;
}

export async function createSectionRule(
	projectId: string,
	rule: SectionRuleInput,
	sortOrder: number,
	signal?: AbortSignal
): Promise<SectionRule> {
	const envelope = await apiClient.post<ApiEnvelope<CpSectionRuleRow>>(
		apiClient.datahub('cp_section_rules'),
		{ project_id: projectId, sort_order: sortOrder, ...sectionRuleBody(rule) },
		{ signal }
	);
	const row = rowsFromEnvelope<CpSectionRuleRow>(envelope.data)[0];
	if (!row) throw new Error('Create section rule returned no data');
	return mapSectionRuleRow(row);
}

export async function updateSectionRule(
	ruleId: string,
	rule: SectionRuleInput,
	signal?: AbortSignal
): Promise<SectionRule> {
	const envelope = await apiClient.patch<ApiEnvelope<CpSectionRuleRow>>(
		apiClient.datahub(`cp_section_rules/${encodeURIComponent(ruleId)}`),
		sectionRuleBody(rule),
		{ signal }
	);
	const row = rowsFromEnvelope<CpSectionRuleRow>(envelope.data)[0];
	if (!row) throw new Error('Update section rule returned no data');
	return mapSectionRuleRow(row);
}

export async function deleteSectionRule(ruleId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`cp_section_rules/${encodeURIComponent(ruleId)}`), {
		signal
	});
}

// ── cp_length_groups ────────────────────────────────────────────────────────────────────────

function mapLengthGroupRow(row: CpLengthGroupRow): LengthGroup {
	return {
		id: row.length_group_id,
		projectId: row.project_id,
		name: row.name,
		minLength: num(row.min_length_mm) ?? 0,
		maxLength: num(row.max_length_mm) ?? 0,
		sortOrder: row.sort_order
	};
}

function lengthGroupBody(group: LengthGroupInput): Record<string, unknown> {
	return {
		name: group.name.trim(),
		min_length_mm: group.minLength,
		max_length_mm: group.maxLength
	};
}

export type LengthGroupInput = Omit<LengthGroup, 'id' | 'projectId' | 'sortOrder'>;

export async function listLengthGroups(
	projectId: string,
	signal?: AbortSignal
): Promise<LengthGroup[]> {
	const envelope = await apiClient.get<ApiEnvelope<CpLengthGroupRow[]>>(
		apiClient.datahub(
			`cp_length_groups?limit=2500&project_id=${encodeURIComponent(projectId)}&orderBy=sort_order:asc`
		),
		{ signal }
	);
	return rowsFromEnvelope<CpLengthGroupRow>(envelope.data).map(mapLengthGroupRow);
}

export async function createLengthGroup(
	projectId: string,
	group: LengthGroupInput,
	sortOrder: number,
	signal?: AbortSignal
): Promise<LengthGroup> {
	const envelope = await apiClient.post<ApiEnvelope<CpLengthGroupRow>>(
		apiClient.datahub('cp_length_groups'),
		{ project_id: projectId, sort_order: sortOrder, ...lengthGroupBody(group) },
		{ signal }
	);
	const row = rowsFromEnvelope<CpLengthGroupRow>(envelope.data)[0];
	if (!row) throw new Error('Create length group returned no data');
	return mapLengthGroupRow(row);
}

export async function updateLengthGroup(
	groupId: string,
	group: LengthGroupInput,
	signal?: AbortSignal
): Promise<LengthGroup> {
	const envelope = await apiClient.patch<ApiEnvelope<CpLengthGroupRow>>(
		apiClient.datahub(`cp_length_groups/${encodeURIComponent(groupId)}`),
		lengthGroupBody(group),
		{ signal }
	);
	const row = rowsFromEnvelope<CpLengthGroupRow>(envelope.data)[0];
	if (!row) throw new Error('Update length group returned no data');
	return mapLengthGroupRow(row);
}

export async function deleteLengthGroup(groupId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`cp_length_groups/${encodeURIComponent(groupId)}`), {
		signal
	});
}

// ── cp_planner_settings (one row per project; upsert) ───────────────────────────────────────

function enforceMarkCohesionFromMetadata(metadata: Record<string, unknown> | undefined): boolean {
	// Prefer schema key; accept legacy metadata.marking_cohesion if present.
	if (metadata?.enforce_mark_cohesion === true || metadata?.marking_cohesion === true) return true;
	return false;
}

function mapPlannerSettingsRow(row: CpPlannerSettingsRow): PlannerSettings {
	return {
		projectId: row.project_id,
		timeLimit: row.time_limit_per_section,
		maxUniqueLengthsPerBar: row.max_unique_lengths_per_bar,
		maxUniqueStockLengthsPerSection: row.max_unique_stock_lengths,
		enforceMarkCohesion: enforceMarkCohesionFromMetadata(row.metadata)
	};
}

function plannerSettingsBody(
	settings: PlannerSettings,
	existingMetadata?: Record<string, unknown>
): Record<string, unknown> {
	const metadata = { ...(existingMetadata ?? {}) };
	delete metadata.marking_cohesion;
	metadata.enforce_mark_cohesion = settings.enforceMarkCohesion;
	return {
		time_limit_per_section: settings.timeLimit,
		max_unique_lengths_per_bar: settings.maxUniqueLengthsPerBar,
		max_unique_stock_lengths: settings.maxUniqueStockLengthsPerSection,
		metadata
	};
}

/** Returns the project's planner settings, or null if none saved yet. */
export async function getPlannerSettings(
	projectId: string,
	signal?: AbortSignal
): Promise<PlannerSettings | null> {
	const envelope = await apiClient.get<ApiEnvelope<CpPlannerSettingsRow[]>>(
		apiClient.datahub(`cp_planner_settings?project_id=${encodeURIComponent(projectId)}`),
		{ signal }
	);
	const row = rowsFromEnvelope<CpPlannerSettingsRow>(envelope.data)[0];
	return row ? mapPlannerSettingsRow(row) : null;
}

/**
 * Upsert the project's planner settings (`unique(project_id)`): PATCH the existing row if present,
 * else POST a new one. Returns the persisted settings.
 */
export async function savePlannerSettings(
	settings: PlannerSettings,
	signal?: AbortSignal
): Promise<PlannerSettings> {
	const existing = await apiClient.get<ApiEnvelope<CpPlannerSettingsRow[]>>(
		apiClient.datahub(`cp_planner_settings?project_id=${encodeURIComponent(settings.projectId)}`),
		{ signal }
	);
	const current = rowsFromEnvelope<CpPlannerSettingsRow>(existing.data)[0];
	const body = plannerSettingsBody(settings, current?.metadata);

	const envelope = current
		? await apiClient.patch<ApiEnvelope<CpPlannerSettingsRow>>(
				apiClient.datahub(`cp_planner_settings/${encodeURIComponent(current.settings_id)}`),
				body,
				{ signal }
			)
		: await apiClient.post<ApiEnvelope<CpPlannerSettingsRow>>(
				apiClient.datahub('cp_planner_settings'),
				{ project_id: settings.projectId, ...body },
				{ signal }
			);

	const row = rowsFromEnvelope<CpPlannerSettingsRow>(envelope.data)[0];
	if (!row) throw new Error('Save planner settings returned no data');
	return mapPlannerSettingsRow(row);
}
