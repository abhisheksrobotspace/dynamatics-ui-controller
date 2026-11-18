import type { PartRow, PlanProject } from './create-plan.types.js';

export function mergePlanLinkDueDates(
	projects: PlanProject[],
	links: Array<{ production_plan_id: string; due_date?: string | null }>
): PlanProject[] {
	const dueByProductionPlan = new Map(
		links.map((link) => [link.production_plan_id, link.due_date ?? null])
	);
	return projects.map((project) => ({
		...project,
		releases: project.releases.map((release) =>
			dueByProductionPlan.has(release.id)
				? { ...release, dueDate: dueByProductionPlan.get(release.id) ?? null }
				: release
		)
	}));
}

export function collectStructureAndBomDueDates(
	projects: PlanProject[],
	selectedReleaseIds?: Set<string>
): {
	structures: Map<string, string | null>;
	boms: Map<string, string | null>;
} {
	const structures = new Map<string, string | null>();
	const boms = new Map<string, string | null>();
	for (const project of projects) {
		for (const release of project.releases) {
			if (selectedReleaseIds && !selectedReleaseIds.has(release.id)) continue;
			for (const parts of [release.towerParts, release.stubs]) {
				for (const row of parts) {
					if ((row.kind === 'tower' || row.kind === 'stub') && row.structureId) {
						structures.set(row.structureId, row.dueDate ?? null);
					}
					if (row.kind === 'bom' && row.bomId) {
						boms.set(row.bomId, row.dueDate ?? null);
					}
				}
			}
		}
	}
	return { structures, boms };
}

function updatePartRowsDueDate(
	parts: PartRow[],
	target: { structureId?: string; bomId?: string },
	dueDate: string | null
): PartRow[] {
	return parts.map((row) => {
		if (target.structureId && row.structureId === target.structureId) {
			return { ...row, dueDate };
		}
		if (target.bomId && row.bomId === target.bomId) {
			return { ...row, dueDate };
		}
		return row;
	});
}

export function setReleaseDueDate(
	projects: PlanProject[],
	releaseId: string,
	dueDate: string | null
): PlanProject[] {
	return projects.map((project) => ({
		...project,
		releases: project.releases.map((release) =>
			release.id === releaseId ? { ...release, dueDate } : release
		)
	}));
}

export function setStructureDueDate(
	projects: PlanProject[],
	structureId: string,
	dueDate: string | null
): PlanProject[] {
	return projects.map((project) => ({
		...project,
		releases: project.releases.map((release) => ({
			...release,
			towerParts: updatePartRowsDueDate(release.towerParts, { structureId }, dueDate),
			stubs: updatePartRowsDueDate(release.stubs, { structureId }, dueDate)
		}))
	}));
}

export function setBomDueDate(
	projects: PlanProject[],
	bomId: string,
	dueDate: string | null
): PlanProject[] {
	return projects.map((project) => ({
		...project,
		releases: project.releases.map((release) => ({
			...release,
			towerParts: updatePartRowsDueDate(release.towerParts, { bomId }, dueDate),
			stubs: updatePartRowsDueDate(release.stubs, { bomId }, dueDate)
		}))
	}));
}

export type DueDateEditTarget =
	| { level: 'release'; releaseId: string; label: string }
	| { level: 'structure'; structureId: string; label: string }
	| { level: 'bom'; bomId: string; label: string };

export function readDueDateForTarget(
	projects: PlanProject[],
	target: DueDateEditTarget
): string | null {
	for (const project of projects) {
		for (const release of project.releases) {
			if (target.level === 'release' && release.id === target.releaseId) {
				return release.dueDate ?? null;
			}
			for (const parts of [release.towerParts, release.stubs]) {
				for (const row of parts) {
					if (target.level === 'structure' && row.structureId === target.structureId) {
						return row.dueDate ?? null;
					}
					if (target.level === 'bom' && row.bomId === target.bomId) {
						return row.dueDate ?? null;
					}
				}
			}
		}
	}
	return null;
}

export function applyDueDateToTarget(
	projects: PlanProject[],
	target: DueDateEditTarget,
	dueDate: string | null
): PlanProject[] {
	if (target.level === 'release') return setReleaseDueDate(projects, target.releaseId, dueDate);
	if (target.level === 'structure')
		return setStructureDueDate(projects, target.structureId, dueDate);
	return setBomDueDate(projects, target.bomId, dueDate);
}

export function dueDatePatchesFromDiff(
	current: Map<string, string | null>,
	initial: Map<string, string | null>
): Array<[string, string | null]> {
	const patches: Array<[string, string | null]> = [];
	const ids = new Set([...current.keys(), ...initial.keys()]);
	for (const id of ids) {
		const next = current.get(id) ?? null;
		const prev = initial.get(id) ?? null;
		if (next !== prev) patches.push([id, next]);
	}
	return patches;
}
