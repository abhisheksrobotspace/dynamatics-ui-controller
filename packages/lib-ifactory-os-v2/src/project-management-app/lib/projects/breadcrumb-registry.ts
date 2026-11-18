import {
	projectStore,
	type BomBreadcrumb,
	type BomConfig,
	type DeliveryScheduleBreadcrumb,
	type ProductionPlanBreadcrumb,
	type Project,
	type ProjectBreadcrumb,
	type ProjectDeliverySchedule,
	type ProjectProductionPlan,
	type ProjectRelease,
	type ReleaseBreadcrumb,
	type StubBreadcrumb,
	type StubType,
	type TowerBreadcrumb,
	type TowerType
} from '../store.svelte.js';

type WithId = { id: string };

function upsertRegistryItem<T extends WithId>(registry: T[], item: T): T[] {
	if (registry.some((entry) => entry.id === item.id)) {
		return registry.map((entry) => (entry.id === item.id ? item : entry));
	}
	return [...registry, item];
}

function removeRegistryItem<T extends WithId>(registry: T[], id: string): T[] {
	return registry.filter((entry) => entry.id !== id);
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function projectBreadcrumbLabel(
	project: ProjectBreadcrumb | undefined,
	fallbackId: string
): string {
	return project?.workOrderNo?.trim() || project?.projectName || fallbackId;
}

export function projectToBreadcrumb(project: Project | ProjectBreadcrumb): ProjectBreadcrumb {
	return {
		id: project.id,
		projectName: project.projectName,
		workOrderNo: project.workOrderNo
	};
}

export function upsertProjectBreadcrumb(project: Project | ProjectBreadcrumb): void {
	projectStore.projects = upsertRegistryItem(projectStore.projects, projectToBreadcrumb(project));
}

export function removeProjectBreadcrumb(projectId: string): void {
	projectStore.projects = removeRegistryItem(projectStore.projects, projectId);
}

export function syncProjectBreadcrumbs(projects: Array<Project | ProjectBreadcrumb>): void {
	projectStore.projects = projects.map(projectToBreadcrumb);
}

// ── Towers ──────────────────────────────────────────────────────────────────

export function towerToBreadcrumb(tower: TowerBreadcrumb): TowerBreadcrumb {
	return {
		id: tower.id,
		projectId: tower.projectId,
		towerTypeName: tower.towerTypeName
	};
}

export function upsertTowerBreadcrumb(tower: TowerBreadcrumb): void {
	projectStore.towerTypes = upsertRegistryItem(projectStore.towerTypes, towerToBreadcrumb(tower));
}

export function removeTowerBreadcrumb(towerId: string): void {
	projectStore.towerTypes = removeRegistryItem(projectStore.towerTypes, towerId);
}

export function replaceTowerBreadcrumbs(projectId: string, towers: TowerBreadcrumb[]): void {
	const otherProjects = projectStore.towerTypes.filter((tower) => tower.projectId !== projectId);
	projectStore.towerTypes = [...otherProjects, ...towers.map(towerToBreadcrumb)];
}

export function syncTowerBreadcrumbs(towers: TowerType[]): void {
	if (towers.length === 0) return;
	replaceTowerBreadcrumbs(towers[0]!.projectId, towers);
}

// ── Stubs ───────────────────────────────────────────────────────────────────

export function stubToBreadcrumb(stub: StubBreadcrumb): StubBreadcrumb {
	return {
		id: stub.id,
		projectId: stub.projectId,
		stubTypeName: stub.stubTypeName
	};
}

export function upsertStubBreadcrumb(stub: StubBreadcrumb): void {
	projectStore.stubTypes = upsertRegistryItem(projectStore.stubTypes, stubToBreadcrumb(stub));
}

export function removeStubBreadcrumb(stubId: string): void {
	projectStore.stubTypes = removeRegistryItem(projectStore.stubTypes, stubId);
}

export function replaceStubBreadcrumbs(projectId: string, stubs: StubBreadcrumb[]): void {
	const otherProjects = projectStore.stubTypes.filter((stub) => stub.projectId !== projectId);
	projectStore.stubTypes = [...otherProjects, ...stubs.map(stubToBreadcrumb)];
}

export function syncStubBreadcrumbs(stubs: StubType[]): void {
	if (stubs.length === 0) return;
	replaceStubBreadcrumbs(stubs[0]!.projectId, stubs);
}

// ── BOMs ────────────────────────────────────────────────────────────────────

export function bomToBreadcrumb(bom: BomBreadcrumb): BomBreadcrumb {
	return {
		id: bom.id,
		towerId: bom.towerId,
		stubId: bom.stubId,
		bomName: bom.bomName,
		bomLineageId: bom.bomLineageId,
		version: bom.version,
		bomFileId: bom.bomFileId ?? null,
		bomFile: bom.bomFile ?? null
	};
}

export function upsertBomBreadcrumb(bom: BomBreadcrumb): void {
	projectStore.bomConfigs = upsertRegistryItem(projectStore.bomConfigs, bomToBreadcrumb(bom));
}

export function removeBomBreadcrumb(bomId: string): void {
	projectStore.bomConfigs = removeRegistryItem(projectStore.bomConfigs, bomId);
}

export function replaceTowerBomBreadcrumbs(towerId: string, boms: BomBreadcrumb[]): void {
	const otherTowers = projectStore.bomConfigs.filter(
		(bom) => !(bom.towerId && bom.towerId === towerId)
	);
	projectStore.bomConfigs = [...otherTowers, ...boms.map(bomToBreadcrumb)];
}

export function replaceStubBomBreadcrumbs(stubId: string, boms: BomBreadcrumb[]): void {
	const otherStubs = projectStore.bomConfigs.filter(
		(bom) => !(bom.stubId && bom.stubId === stubId)
	);
	projectStore.bomConfigs = [...otherStubs, ...boms.map(bomToBreadcrumb)];
}

export function syncTowerBomBreadcrumbs(boms: BomConfig[]): void {
	if (boms.length === 0) return;
	const towerId = boms[0]!.towerId;
	if (!towerId) return;
	replaceTowerBomBreadcrumbs(
		towerId,
		boms.map((bom) => ({
			id: bom.id,
			towerId: bom.towerId,
			stubId: bom.stubId,
			bomName: bom.bomName,
			bomLineageId: bom.bomLineageId,
			version: bom.version,
			bomFileId: bom.bomFileId ?? null,
			bomFile: bom.bomFile ?? null
		}))
	);
}

export function syncStubBomBreadcrumbs(boms: BomConfig[]): void {
	if (boms.length === 0) return;
	const stubId = boms[0]!.stubId;
	if (!stubId) return;
	replaceStubBomBreadcrumbs(
		stubId,
		boms.map((bom) => ({
			id: bom.id,
			towerId: bom.towerId,
			stubId: bom.stubId,
			bomName: bom.bomName,
			bomLineageId: bom.bomLineageId,
			version: bom.version,
			bomFileId: bom.bomFileId ?? null,
			bomFile: bom.bomFile ?? null
		}))
	);
}

// ── Releases ────────────────────────────────────────────────────────────────

export function releaseToBreadcrumb(release: ReleaseBreadcrumb): ReleaseBreadcrumb {
	return {
		id: release.id,
		projectId: release.projectId,
		name: release.name,
		date: release.date
	};
}

export function upsertReleaseBreadcrumb(release: ReleaseBreadcrumb): void {
	projectStore.releases = upsertRegistryItem(projectStore.releases, releaseToBreadcrumb(release));
}

export function removeReleaseBreadcrumb(releaseId: string): void {
	projectStore.releases = removeRegistryItem(projectStore.releases, releaseId);
}

export function replaceReleaseBreadcrumbs(projectId: string, releases: ReleaseBreadcrumb[]): void {
	const otherProjects = projectStore.releases.filter((release) => release.projectId !== projectId);
	projectStore.releases = [...otherProjects, ...releases.map(releaseToBreadcrumb)];
}

export function syncReleaseBreadcrumbs(releases: ProjectRelease[]): void {
	if (releases.length === 0) return;
	replaceReleaseBreadcrumbs(
		releases[0]!.projectId,
		releases.map((release) => ({
			id: release.id,
			projectId: release.projectId,
			name: release.name,
			date: release.date
		}))
	);
}

// ── Delivery schedules ──────────────────────────────────────────────────────

export function deliveryScheduleToBreadcrumb(
	schedule: DeliveryScheduleBreadcrumb
): DeliveryScheduleBreadcrumb {
	return {
		id: schedule.id,
		projectId: schedule.projectId,
		name: schedule.name,
		date: schedule.date
	};
}

export function upsertDeliveryScheduleBreadcrumb(schedule: DeliveryScheduleBreadcrumb): void {
	projectStore.deliverySchedules = upsertRegistryItem(
		projectStore.deliverySchedules,
		deliveryScheduleToBreadcrumb(schedule)
	);
}

export function removeDeliveryScheduleBreadcrumb(scheduleId: string): void {
	projectStore.deliverySchedules = removeRegistryItem(projectStore.deliverySchedules, scheduleId);
}

export function replaceDeliveryScheduleBreadcrumbs(
	projectId: string,
	schedules: DeliveryScheduleBreadcrumb[]
): void {
	const otherProjects = projectStore.deliverySchedules.filter(
		(schedule) => schedule.projectId !== projectId
	);
	projectStore.deliverySchedules = [
		...otherProjects,
		...schedules.map(deliveryScheduleToBreadcrumb)
	];
}

export function syncDeliveryScheduleBreadcrumbs(schedules: ProjectDeliverySchedule[]): void {
	if (schedules.length === 0) return;
	replaceDeliveryScheduleBreadcrumbs(
		schedules[0]!.projectId,
		schedules.map((schedule) => ({
			id: schedule.id,
			projectId: schedule.projectId,
			name: schedule.name,
			date: schedule.date
		}))
	);
}

// ── Production plans ────────────────────────────────────────────────────────

export function productionPlanToBreadcrumb(
	plan: ProductionPlanBreadcrumb
): ProductionPlanBreadcrumb {
	return {
		id: plan.id,
		projectId: plan.projectId,
		name: plan.name
	};
}

export function upsertProductionPlanBreadcrumb(plan: ProductionPlanBreadcrumb): void {
	projectStore.productionPlans = upsertRegistryItem(
		projectStore.productionPlans,
		productionPlanToBreadcrumb(plan)
	);
}

export function removeProductionPlanBreadcrumb(planId: string): void {
	projectStore.productionPlans = removeRegistryItem(projectStore.productionPlans, planId);
}

export function replaceProductionPlanBreadcrumbs(
	projectId: string,
	plans: ProductionPlanBreadcrumb[]
): void {
	const otherProjects = projectStore.productionPlans.filter((plan) => plan.projectId !== projectId);
	projectStore.productionPlans = [...otherProjects, ...plans.map(productionPlanToBreadcrumb)];
}

export function syncProductionPlanBreadcrumbs(plans: ProjectProductionPlan[]): void {
	if (plans.length === 0) return;
	replaceProductionPlanBreadcrumbs(
		plans[0]!.projectId,
		plans.map((plan) => ({
			id: plan.id,
			projectId: plan.projectId,
			name: plan.name
		}))
	);
}
