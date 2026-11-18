import type { TreeTableNode } from '@ifactory/ui-v2';
import { resolveDueDate } from './due-dates.js';
import type { PartRow, PlanProject } from './create-plan.types.js';

export type PlanTreeRowLevel = 'project' | 'release' | 'structure' | 'bom';

export type PlanTreeRowData = {
	level: PlanTreeRowLevel;
	sr?: string;
	unit?: string;
	releaseQty?: string;
	weightMt?: number;
	holdLabel?: string;
	releaseId?: string;
	structureId?: string;
	bomId?: string;
	/** Due date set at this row's level (ISO). */
	dueDate?: string | null;
	/** Resolved due date walking precedence down to plan (ISO). */
	effectiveDueDate?: string | null;
};

function finalizeStructureTotals(node: TreeTableNode<PlanTreeRowData>): void {
	const children = node.children ?? [];
	const weightMt = children.reduce((sum, child) => sum + (child.data?.weightMt ?? 0), 0);
	if (!node.data) return;
	node.data.weightMt = weightMt;
}

function structureNodesFromPartRows(
	parts: PartRow[],
	idPrefix: string,
	releaseDueDate: string | null,
	planDueDate: string | null
): TreeTableNode<PlanTreeRowData>[] {
	const nodes: TreeTableNode<PlanTreeRowData>[] = [];
	let current: TreeTableNode<PlanTreeRowData> | null = null;
	let currentStructureDueDate: string | null = null;

	for (const row of parts) {
		if (row.kind === 'tower' || row.kind === 'stub') {
			if (current) finalizeStructureTotals(current);
			currentStructureDueDate = row.dueDate ?? null;
			current = {
				id: `${idPrefix}-${row.key}`,
				label: row.description,
				collapsible: false,
				data: {
					level: 'structure',
					structureId: row.structureId,
					dueDate: currentStructureDueDate,
					effectiveDueDate: resolveDueDate([currentStructureDueDate, releaseDueDate, planDueDate])
				},
				children: []
			};
			nodes.push(current);
			continue;
		}

		if (row.kind === 'bom' && current) {
			const bomDueDate = row.dueDate ?? null;
			current.children = current.children ?? [];
			current.children.push({
				id: `${idPrefix}-${row.key}`,
				label: row.description,
				data: {
					level: 'bom',
					unit: row.unit,
					releaseQty: row.release,
					weightMt: row.weightMt,
					holdLabel: row.holdLabel,
					bomId: row.bomId,
					dueDate: bomDueDate,
					effectiveDueDate: resolveDueDate([
						bomDueDate,
						currentStructureDueDate,
						releaseDueDate,
						planDueDate
					])
				}
			});
		}
	}

	if (current) finalizeStructureTotals(current);
	return nodes;
}

function releaseTreeNode(
	release: PlanProject['releases'][number],
	projectId: string,
	planDueDate: string | null
): TreeTableNode<PlanTreeRowData> {
	const releaseDueDate = release.dueDate ?? null;
	const towerStructures = structureNodesFromPartRows(
		release.towerParts,
		`tower-${projectId}-${release.id}`,
		releaseDueDate,
		planDueDate
	);
	const stubStructures = structureNodesFromPartRows(
		release.stubs,
		`stub-${projectId}-${release.id}`,
		releaseDueDate,
		planDueDate
	);

	return {
		id: `release-${release.id}`,
		label: release.label,
		data: {
			level: 'release',
			releaseId: release.id,
			weightMt: release.batchWeightMt,
			dueDate: releaseDueDate,
			effectiveDueDate: resolveDueDate([releaseDueDate, planDueDate])
		},
		children: [...towerStructures, ...stubStructures]
	};
}

/** Project → release → tower/stub type → BOM tree for selected plan releases. */
export function buildPlanTreeNodes(
	projects: PlanProject[],
	selectedReleaseIds: Set<string> | string[],
	planDueDate: string | null = null
): TreeTableNode<PlanTreeRowData>[] {
	const selected =
		selectedReleaseIds instanceof Set ? selectedReleaseIds : new Set(selectedReleaseIds);

	return projects
		.map((project) => {
			const releases = project.releases.filter((release) => selected.has(release.id));
			if (releases.length === 0) return null;

			const projectWeightMt = releases.reduce((sum, release) => sum + release.batchWeightMt, 0);

			return {
				id: `project-${project.id}`,
				label: project.title,
				defaultExpanded: true,
				data: {
					level: 'project' as const,
					weightMt: projectWeightMt
				},
				children: releases.map((release) => releaseTreeNode(release, project.id, planDueDate))
			} satisfies TreeTableNode<PlanTreeRowData>;
		})
		.filter((node): node is TreeTableNode<PlanTreeRowData> => node !== null);
}

export function planTreeFilterMatch(
	node: TreeTableNode<PlanTreeRowData>,
	normalizedQuery: string
): boolean {
	if (node.label.toLowerCase().includes(normalizedQuery)) return true;
	const data = node.data;
	if (!data) return false;
	return [data.sr, data.unit, data.releaseQty, data.weightMt != null ? String(data.weightMt) : '']
		.filter(Boolean)
		.some((value) => String(value).toLowerCase().includes(normalizedQuery));
}
