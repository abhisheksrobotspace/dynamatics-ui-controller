import { loadCuttingPlanDraft } from './draft-cache';
import { getLatestPlanRun } from './plan-runs';

export type CuttingPlanBreadcrumbCrumb = {
	label: string;
	href: string;
	clickable: boolean;
};

type CuttingPlanBreadcrumbContext = {
	bomId: string;
	replanFromExisting: boolean;
	resultsRunId: string | null;
};

let context: CuttingPlanBreadcrumbContext | null = null;

export function clearCuttingPlanBreadcrumbContext(): void {
	context = null;
}

export function getCuttingPlanBreadcrumbContext(): CuttingPlanBreadcrumbContext | null {
	return context;
}

/** Resolve replan breadcrumb state before postProcessBreadcrumbs runs. */
export async function prepareCuttingPlanBreadcrumbContext(bomId: string): Promise<void> {
	const draft = await loadCuttingPlanDraft(bomId);
	let resultsRunId = draft?.replanSourceRunId ?? null;

	if (!resultsRunId && draft?.replanFromExisting) {
		const latestRun = await getLatestPlanRun(bomId);
		resultsRunId = latestRun?.id ?? null;
	}

	context = {
		bomId,
		replanFromExisting: Boolean(draft?.replanFromExisting),
		resultsRunId
	};
}

export function appendCuttingPlanCreateBreadcrumbs(
	crumbsList: CuttingPlanBreadcrumbCrumb[],
	input: {
		bomBasePath: string;
		bomId: string;
		page: 'Sections' | 'StockLengths';
	}
): void {
	const replanContext = getCuttingPlanBreadcrumbContext();
	const isReplan = replanContext?.bomId === input.bomId && replanContext.replanFromExisting;

	crumbsList.push({
		label: 'Cutting Plan',
		href: `${input.bomBasePath}/Runs`,
		clickable: true
	});

	if (isReplan) {
		const resultsHref = replanContext.resultsRunId
			? `${input.bomBasePath}/Runs/${replanContext.resultsRunId}/Summary`
			: '';
		crumbsList.push({
			label: 'Results',
			href: resultsHref,
			clickable: Boolean(resultsHref)
		});
		if (input.page === 'StockLengths') {
			crumbsList.push({
				label: 'Select Sections',
				href: `${input.bomBasePath}/Sections`,
				clickable: true
			});
			crumbsList.push({ label: 'Stock Lengths', href: '', clickable: false });
		} else {
			crumbsList.push({ label: 'Select Sections', href: '', clickable: false });
		}
		return;
	}

	if (input.page === 'Sections') {
		crumbsList.push({ label: 'Select Sections', href: '', clickable: false });
		return;
	}

	crumbsList.push({
		label: 'Select Sections',
		href: `${input.bomBasePath}/Sections`,
		clickable: true
	});
	crumbsList.push({ label: 'Stock Lengths', href: '', clickable: false });
}
