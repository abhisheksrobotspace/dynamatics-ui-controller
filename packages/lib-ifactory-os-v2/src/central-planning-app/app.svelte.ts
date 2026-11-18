import PlanningPlansHome from './routes/PlanningPlansHome.svelte';
import PlanningSheet from './routes/PlanningSheet.svelte';
import ManufacturingPlansHome from '../rm-indent-app/routes/ManufacturingPlansHome.svelte';
import ManufacturingPlan from '../rm-indent-app/routes/ManufacturingPlan.svelte';
import GroupedAssignAndLock from '../rm-indent-app/routes/GroupedAssignAndLock.svelte';
import {
	CENTRAL_PLANNING_CAPABILITIES,
	type PlanningAppData
} from '../rm-indent-app/lib/planning-capabilities.js';
import { createPlanningMenu } from '../rm-indent-app/lib/planning-app-menu.js';
import {
	ensurePlanningSheetPlanLabel,
	getPendingPlanName,
	getPlanningSheetPlanLabel
} from './lib/planning-sheet.store.js';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';

const appName = 'CentralPlanning';

const data: PlanningAppData = {
	appName,
	capabilities: CENTRAL_PLANNING_CAPABILITIES
};

const baseMenu = createPlanningMenu({ includeRaiseIndent: false });

export const app = {
	appName,
	appCode: 'CP',
	displayName: 'Central Planning',
	dockColor: '#8B5CF6',
	icon: '/assets/icons/approvals.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	data,
	routes: {
		Home: PlanningPlansHome,
		'Sheet/:planId': PlanningSheet,
		ManufacturingPlans: ManufacturingPlansHome,
		'ManufacturingPlan/:planId': ManufacturingPlan,
		'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId': GroupedAssignAndLock
	},
	menu: {
		...baseMenu,
		prepareRoute: async (pattern: string, params: Record<string, string>, signal?: AbortSignal) => {
			if (pattern === 'Sheet/:planId' && params.planId) {
				const id = decodeURIComponent(params.planId);
				if (id !== 'new') await ensurePlanningSheetPlanLabel(id, signal);
			}
			await baseMenu.prepareRoute?.(pattern, params, signal);
		},
		routeTitles: {
			...baseMenu.routeTitles,
			Home: 'Plans',
			ManufacturingPlans: 'Manufacturing Plans'
		},
		resolveRouteTitle: (pattern: string, params: Record<string, string>) => {
			if (pattern === 'Sheet/:planId') {
				const id = params.planId ? decodeURIComponent(params.planId) : '';
				if (id === 'new') return getPendingPlanName() ?? 'New Plan';
				return getPlanningSheetPlanLabel(id);
			}
			return baseMenu.resolveRouteTitle?.(pattern, params);
		},
		postProcessBreadcrumbs: (
			crumbs: Array<{ label: string; href?: string; clickable?: boolean }>,
			pattern: string,
			params: Record<string, string>
		) => {
			if (pattern === 'Sheet/:planId') {
				const id = params.planId ? decodeURIComponent(params.planId) : 'new';
				const sheetLabel =
					id === 'new' ? (getPendingPlanName() ?? 'New Plan') : getPlanningSheetPlanLabel(id);
				return [
					{ label: 'Plans', href: 'Home', clickable: true },
					{ label: sheetLabel, clickable: false }
				];
			}
			const processed = baseMenu.postProcessBreadcrumbs(crumbs, pattern, params);
			return processed.map((crumb) => {
				if (crumb.label === 'Manufacturing Plans') {
					return { ...crumb, label: 'Plans', href: 'Home', clickable: true };
				}
				return crumb;
			});
		}
	}
};
