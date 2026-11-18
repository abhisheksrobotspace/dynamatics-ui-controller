import { getCuttingPlans } from './cutting-plans.api';

export type IndentSourceProject = {
	project_id: string;
	label: string;
	work_order: string;
};

export type IndentSourceTower = {
	structure_id: string;
	project_id: string;
	label: string;
};

export type IndentSourceBom = {
	bom_id: string;
	structure_id: string;
	project_id: string;
	label: string;
	cutting_plan_id: string;
	run_version_label: string;
};

export type IndentSourceOptions = {
	projects: IndentSourceProject[];
	towers: IndentSourceTower[];
	boms: IndentSourceBom[];
};

function workOrderFromProjectLabel(label: string): string {
	const separator = ' - ';
	const index = label.indexOf(separator);
	if (index === -1) return label.trim();
	return label.slice(0, index).trim();
}

function sortByLabel<T extends { label: string }>(rows: T[]): T[] {
	return rows.sort((a, b) => a.label.localeCompare(b.label));
}

/** Projects, towers, and BOMs that have a published cutting plan (latest run per BOM). */
export async function getIndentSourceOptions(signal?: AbortSignal): Promise<IndentSourceOptions> {
	const plans = await getCuttingPlans(signal);

	const projects = new Map<string, IndentSourceProject>();
	const towers = new Map<string, IndentSourceTower>();
	const boms = new Map<string, IndentSourceBom & { run_version: number }>();

	for (const plan of plans) {
		if (!plan.project_id) continue;

		projects.set(plan.project_id, {
			project_id: plan.project_id,
			label: plan.project_label,
			work_order: workOrderFromProjectLabel(plan.project_label)
		});

		if (!plan.structure_id) continue;

		towers.set(plan.structure_id, {
			structure_id: plan.structure_id,
			project_id: plan.project_id,
			label: plan.tower_label
		});

		if (!plan.bom_id) continue;

		const existing = boms.get(plan.bom_id);
		if (!existing || plan.run_version > existing.run_version) {
			boms.set(plan.bom_id, {
				bom_id: plan.bom_id,
				structure_id: plan.structure_id,
				project_id: plan.project_id,
				label: plan.bom_label,
				cutting_plan_id: plan.cutting_plan_id,
				run_version_label: plan.version_label,
				run_version: plan.run_version
			});
		}
	}

	return {
		projects: sortByLabel([...projects.values()]),
		towers: sortByLabel([...towers.values()]),
		boms: sortByLabel(
			[...boms.values()].map(
				({ bom_id, structure_id, project_id, label, cutting_plan_id, run_version_label }) => ({
					bom_id,
					structure_id,
					project_id,
					label,
					cutting_plan_id,
					run_version_label
				})
			)
		)
	};
}
