import { openAppAtHash } from '$lib/os/index.svelte';
import {
	bomSectionsHash,
	type BomStructureRef
} from '../../project-management-app/lib/bom-structure-routes.js';
import {
	stashAssignLockReplanAccept,
	stashCuttingPlanReturnHash
} from '../../cutting-plan-app/lib/cutting-plan/cutting-plan-host.js';
import { stashPendingSectionReplan } from '../../cutting-plan-app/lib/cutting-plan/replan-sections.js';
import type { AssignLockReplanContext } from './assign-and-lock.tree.js';

export function structureRefFromKind(structureId: string, kind: 'tower' | 'stub'): BomStructureRef {
	return kind === 'stub'
		? { kind: 'stub', stubId: structureId }
		: { kind: 'tower', towerId: structureId };
}

/** Apps that host the cutting-plan wizard in-process (do not open the CuttingPlan dock app). */
const IN_APP_REPLAN_HOSTS = new Set(['ShopFloorPlanning', 'RMI']);

/**
 * Partial replan for one BOM section — navigates immediately; draft is prepared on the
 * Select Sections page so Lock does not show an "Opening…" state.
 */
export async function startSingleSectionReplan(input: {
	projectId: string;
	sectionName: string;
	replan: AssignLockReplanContext;
	/** Length on the Lock row being left (deselected by default on Stock Lengths). */
	excludeStockLengthMm?: number;
	deliveryScheduleLineId?: string;
	/**
	 * Host OS app for the wizard. `ShopFloorPlanning` / `RMI` keep replan in that app;
	 * anything else opens the Cutting Plan dock app.
	 */
	hostAppName?: string;
}): Promise<void> {
	const hostAppName = input.hostAppName ?? 'CuttingPlan';
	const structure = structureRefFromKind(input.replan.structureId, input.replan.structureKind);
	const sectionsHash = bomSectionsHash(input.projectId, structure, input.replan.bomId, hostAppName);
	const returnHash = window.location.hash;

	stashCuttingPlanReturnHash(returnHash);
	stashAssignLockReplanAccept({
		projectId: input.projectId,
		bomId: input.replan.bomId,
		returnHash,
		...(input.deliveryScheduleLineId
			? { deliveryScheduleLineId: input.deliveryScheduleLineId }
			: {})
	});
	stashPendingSectionReplan(input.replan.bomId, [input.sectionName], {
		sourceRunId: input.replan.sourceRunId,
		...(input.excludeStockLengthMm && input.excludeStockLengthMm > 0
			? { excludeStockLengths: [input.excludeStockLengthMm] }
			: {})
	});

	if (hostAppName === 'ShopFloorPlanning') {
		// Dynamic import avoids a circular dependency with shop-floor-planning-app → this module.
		const { app } = await import('../../shop-floor-planning-app/app.svelte.ts');
		openAppAtHash(app, sectionsHash);
		return;
	}

	if (hostAppName === 'RMI') {
		const { app } = await import('../app.svelte.ts');
		openAppAtHash(app, sectionsHash);
		return;
	}

	const { app } = await import('../../cutting-plan-app/app.svelte.ts');
	openAppAtHash(app, sectionsHash);
}

export function isInAppReplanHost(appName: string): boolean {
	return IN_APP_REPLAN_HOSTS.has(appName);
}
