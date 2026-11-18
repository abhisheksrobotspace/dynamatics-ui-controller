import type { TableBadgeAction } from '@ifactory/ui-v2';
import { canStartCuttingPlan } from './bom-extract-status.js';
import { hasCuttingPlanResults } from '../../cutting-plan-app/lib/cutting-plan/cutting-plan-results.svelte.js';
import { isCuttingPlanRunning } from '../../cutting-plan-app/lib/cutting-plan/cutting-plan-running.svelte.js';
import { getPublishedCpRunIdFromBom } from './projects/boms.api.js';
import type { BomConfig } from './store.svelte.js';

const STATUS_BADGE_CLASS =
	'inline-flex w-[7rem] shrink-0 items-center justify-start whitespace-nowrap box-border';

/**
 * A BOM has a cutting plan to view. `cpStatus` is the server cache on `proj_boms`, so it's stale for
 * a run that finished after this list loaded — the client-side result mark covers that window.
 */
export function isCuttingPlanReady(row: BomConfig): boolean {
	return row.cpStatus === 'planned' || hasCuttingPlanResults(row.id);
}

/** Cutting Plan cell status — running / published / ready / blocked / not planned. */
export function cuttingPlanStatusBadge(row: BomConfig, hasSectionRules: boolean): TableBadgeAction {
	if (isCuttingPlanRunning(row.id)) {
		return {
			type: 'badge',
			label: 'Running',
			variant: 'default',
			dot: true,
			class: STATUS_BADGE_CLASS
		};
	}
	if (getPublishedCpRunIdFromBom(row)) {
		// Badge `loading` uses the blue status token in ui-v2.
		return {
			type: 'badge',
			label: 'Published',
			variant: 'loading',
			class: STATUS_BADGE_CLASS
		};
	}
	if (isCuttingPlanReady(row)) {
		return {
			type: 'badge',
			label: 'Ready',
			variant: 'online',
			class: STATUS_BADGE_CLASS
		};
	}
	if (!canStartCuttingPlan(row, hasSectionRules)) {
		return {
			type: 'badge',
			label: 'Blocked',
			variant: 'offline',
			class: STATUS_BADGE_CLASS
		};
	}
	return {
		type: 'badge',
		label: 'Not planned',
		variant: 'offline',
		class: STATUS_BADGE_CLASS
	};
}
