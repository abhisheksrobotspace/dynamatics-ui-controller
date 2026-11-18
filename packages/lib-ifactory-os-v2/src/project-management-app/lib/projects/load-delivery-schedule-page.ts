import type {
	BomConfig,
	DeliveryScheduleBreadcrumb,
	ProjectDeliverySchedule,
	ReleaseTowerEntry,
	StubType,
	TowerType
} from '../store.svelte.js';
import { projectStore } from '../store.svelte.js';
import { alreadyReleasedByBomId, buildAllStructureEntries } from '../release.utils.js';
import {
	deliveryScheduleToBreadcrumb,
	upsertDeliveryScheduleBreadcrumb
} from './breadcrumb-registry.js';
import {
	getDeliveryScheduleById,
	listProjectDeliveryScheduleLinesForProject,
	mapDeliveryScheduleRow,
	scheduleLinesAsReleaseLines
} from './delivery-schedules.api.js';
import { listBomSetWeightKgByBomIds } from './bom-set-weight.js';
import { listDeliveryScheduleStructuresWithBoms } from './load-delivery-schedule.js';
import type { ProjDeliveryScheduleLineRow } from './types.js';

/**
 * Fetches a single schedule label when missing from the breadcrumb registry (deep-links / reload).
 */
export async function ensureDeliveryScheduleBreadcrumb(
	scheduleId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<DeliveryScheduleBreadcrumb | null> {
	const existing = projectStore.deliverySchedules.find((schedule) => schedule.id === scheduleId);
	if (existing) return existing;

	const schedule = await getDeliveryScheduleById(scheduleId, projectId, signal);
	if (!schedule) return null;

	upsertDeliveryScheduleBreadcrumb(schedule);
	return deliveryScheduleToBreadcrumb(schedule);
}

export type DeliverySchedulePageData = {
	schedule: ProjectDeliverySchedule;
	towers: TowerType[];
	stubs: StubType[];
	towerBoms: BomConfig[];
	stubBoms: BomConfig[];
	persistedLines: ProjDeliveryScheduleLineRow[];
	alreadyScheduledByBom: Map<string, number>;
	draftTowerEntries: ReleaseTowerEntry[];
	draftStubEntries: ReleaseTowerEntry[];
	setKgByBomId: Map<string, number>;
};

/**
 * Load delivery-schedule editor data with batched `__in` queries.
 * Reuses release tree utilities by adapting DS lines to the release-line shape.
 */
export async function loadDeliverySchedulePageData(
	projectId: string,
	scheduleId: string,
	signal?: AbortSignal
): Promise<DeliverySchedulePageData> {
	const [structuresWithBoms, projectScheduleBundles] = await Promise.all([
		listDeliveryScheduleStructuresWithBoms(projectId, signal),
		listProjectDeliveryScheduleLinesForProject(projectId, signal)
	]);

	const currentIndex = projectScheduleBundles.findIndex(
		(bundle) => bundle.schedule.delivery_schedule_id === scheduleId
	);
	if (currentIndex < 0) {
		throw new Error('Delivery schedule not found');
	}

	const { towers, stubs, towerBoms, stubBoms } = structuresWithBoms;
	const current = projectScheduleBundles[currentIndex]!;
	const persistedLines = current.lines;
	const schedule = mapDeliveryScheduleRow(current.schedule, currentIndex + 1);
	const adaptedLines = scheduleLinesAsReleaseLines(persistedLines);

	upsertDeliveryScheduleBreadcrumb(schedule);

	const alreadyScheduledByBom = alreadyReleasedByBomId(
		projectScheduleBundles.map((bundle) => ({
			releaseId: bundle.schedule.delivery_schedule_id,
			lines: scheduleLinesAsReleaseLines(bundle.lines)
		})),
		scheduleId
	);

	const draftTowerEntries = buildAllStructureEntries(
		scheduleId,
		adaptedLines,
		towerBoms,
		towers,
		alreadyScheduledByBom,
		'tower'
	);
	const draftStubEntries = buildAllStructureEntries(
		scheduleId,
		adaptedLines,
		stubBoms,
		stubs,
		alreadyScheduledByBom,
		'stub'
	);

	const setKgByBomId = await listBomSetWeightKgByBomIds(
		[...towerBoms, ...stubBoms].map((bom) => bom.id),
		signal
	);

	return {
		schedule,
		towers,
		stubs,
		towerBoms,
		stubBoms,
		persistedLines,
		alreadyScheduledByBom,
		draftTowerEntries,
		draftStubEntries,
		setKgByBomId
	};
}
