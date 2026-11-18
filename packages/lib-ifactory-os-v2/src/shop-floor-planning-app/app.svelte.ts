import ManufacturingPlansHome from '../rm-indent-app/routes/ManufacturingPlansHome.svelte';
import ManufacturingPlan from '../rm-indent-app/routes/ManufacturingPlan.svelte';
import GroupedAssignAndLock from '../rm-indent-app/routes/GroupedAssignAndLock.svelte';
import CuttingPlanCreateSections from '../cutting-plan-app/routes/CuttingPlanCreateSections.svelte';
import CuttingPlanCreateStockLengths from '../cutting-plan-app/routes/CuttingPlanCreateStockLengths.svelte';
import CuttingPlanRuns from '../cutting-plan-app/routes/CuttingPlanRuns.svelte';
import CuttingPlanResultsSummary from '../cutting-plan-app/routes/CuttingPlanResultsSummary.svelte';
import CuttingPlanPlanner from '../cutting-plan-app/routes/CuttingPlanPlanner.svelte';
import ScheduleSetup from '../aps-app/routes/ScheduleSetup.svelte';
import ProductionSchedule from '../aps-app/routes/ProductionSchedule.svelte';
import ScheduleRuns from '../aps-app/routes/ScheduleRuns.svelte';
import ScheduleReport from '../aps-app/routes/ScheduleReport.svelte';
import MachinesReport from '../aps-app/routes/MachinesReport.svelte';
import JobCardsList from '../aps-app/routes/JobCardsList.svelte';
import JobCardDetail from '../aps-app/routes/JobCardDetail.svelte';
import {
	getManufacturingPlanLabel,
	ensureManufacturingPlanLabel
} from '../aps-app/lib/manufacturing-plans.js';
import { ensureScheduleRunLabel, getScheduleRunLabel } from '../aps-app/lib/schedule-runs.js';
import { ensureJobCardLabel, getJobCardLabel } from '../aps-app/lib/job-cards.api.js';
import {
	SHOP_FLOOR_PLANNING_CAPABILITIES,
	type PlanningAppData
} from '../rm-indent-app/lib/planning-capabilities.js';
import { createPlanningMenu } from '../rm-indent-app/lib/planning-app-menu.js';
import { getPlanningSheetPlanLabel } from '../central-planning-app/lib/planning-sheet.store.js';
import PublishedPlansHome from './routes/PublishedPlansHome.svelte';
import PublishedPlanningSheet from './routes/PublishedPlanningSheet.svelte';
import ApsRunsHome from './routes/ApsRunsHome.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import { SHOP_FLOOR_APP_NAME } from './lib/app-name.js';

const appName = SHOP_FLOOR_APP_NAME;

const data: PlanningAppData = {
	appName,
	capabilities: SHOP_FLOOR_PLANNING_CAPABILITIES
};

const cuttingPlanRoutes = {
	'Home/:projectId/Towers/:towerId/Boms/:bomId/Sections': CuttingPlanCreateSections,
	'Home/:projectId/Towers/:towerId/Boms/:bomId/StockLengths': CuttingPlanCreateStockLengths,
	'Home/:projectId/Towers/:towerId/Boms/:bomId/Runs': CuttingPlanRuns,
	'Home/:projectId/Towers/:towerId/Boms/:bomId/Runs/:runId/Summary': CuttingPlanResultsSummary,
	'Home/:projectId/Towers/:towerId/Boms/:bomId/Runs/:runId/Plan': CuttingPlanPlanner,
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/Sections': CuttingPlanCreateSections,
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/StockLengths': CuttingPlanCreateStockLengths,
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/Runs': CuttingPlanRuns,
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/Runs/:runId/Summary': CuttingPlanResultsSummary,
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/Runs/:runId/Plan': CuttingPlanPlanner
};

/** APS hosted under SFP. `planId` route param = `aps_schedule_requests.request_id`. */
const apsRoutes = {
	'Aps/:planId/Review': ScheduleSetup,
	'Aps/:planId/Setup': ScheduleSetup,
	'Aps/:planId/ProductionSchedule': ProductionSchedule,
	'Aps/:planId/ProductionSchedule/:runId': ProductionSchedule,
	'Aps/:planId/Runs': ScheduleRuns,
	'Aps/:planId/Schedule': ScheduleReport,
	'Aps/:planId/Machines': MachinesReport,
	'Aps/:planId/JobCards/run/:runId': JobCardsList,
	'Aps/:planId/JobCards': JobCardsList,
	'Aps/:planId/JobCards/:jobId': JobCardDetail,
	ApsRuns: ApsRunsHome,
	'ApsRuns/:planId': ScheduleRuns
};

const baseMenu = createPlanningMenu({ includeRaiseIndent: false, includeCuttingPlanReplan: true });

export const app = {
	appName,
	appCode: 'SFP',
	displayName: 'Shop Floor Planning',
	dockColor: '#F59E0B',
	icon: '/assets/icons/utilities.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	data,
	routes: {
		Home: PublishedPlansHome,
		'Sheet/:planId/:month': PublishedPlanningSheet,
		...apsRoutes,
		// Legacy Assign & Lock routes (still reachable by URL / cutting-plan links).
		ManufacturingPlans: ManufacturingPlansHome,
		'ManufacturingPlan/:planId': ManufacturingPlan,
		'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId': GroupedAssignAndLock,
		...cuttingPlanRoutes
	},
	menu: {
		...baseMenu,
		prepareRoute: async (pattern: string, params: Record<string, string>, signal?: AbortSignal) => {
			const planId = params.planId?.trim();
			// Cold refresh / deep-link: resolve plan name before breadcrumbs (else UUID).
			// Soft nav from APS Runs is a no-op when the label map is already warm.
			if (planId && (pattern.startsWith('Aps/:planId') || pattern.startsWith('ApsRuns/:planId'))) {
				await ensureManufacturingPlanLabel(planId, signal);
			}
			const runId = params.runId?.trim();
			if (planId && runId && pattern === 'Aps/:planId/ProductionSchedule/:runId') {
				await ensureScheduleRunLabel(runId, planId, signal);
			}
			const jobId = params.jobId?.trim();
			if (jobId && pattern === 'Aps/:planId/JobCards/:jobId') {
				await ensureJobCardLabel(jobId, signal);
			}
			await baseMenu.prepareRoute?.(pattern, params, signal);
		},
		routeTitles: {
			...baseMenu.routeTitles,
			Home: 'Plans',
			ApsRuns: 'APS Runs',
			'Aps/:planId/Review': 'Review Input',
			'Aps/:planId/Setup': 'Schedule Setup',
			'Aps/:planId/ProductionSchedule': 'Production Schedule',
			'Aps/:planId/Runs': 'All Runs',
			'ApsRuns/:planId': 'All Runs',
			'Aps/:planId/Schedule': 'Schedule Report',
			'Aps/:planId/Machines': 'Machines Report',
			'Aps/:planId/JobCards': 'Job Cards',
			'Aps/:planId/JobCards/run/:runId': 'Job Cards',
			ManufacturingPlans: 'Manufacturing Plans'
		},
		breadcrumbParents: {
			...baseMenu.breadcrumbParents,
			'Aps/:planId/Runs': {
				label: 'APS Runs',
				href: 'ApsRuns'
			},
			'ApsRuns/:planId': {
				label: 'APS Runs',
				href: 'ApsRuns'
			},
			'Aps/:planId/Schedule': {
				label: 'Production Schedule',
				href: (params: Record<string, string>) =>
					`Aps/${encodeURIComponent(params.planId ?? '')}/ProductionSchedule`
			},
			'Aps/:planId/Machines': {
				label: 'Production Schedule',
				href: (params: Record<string, string>) =>
					`Aps/${encodeURIComponent(params.planId ?? '')}/ProductionSchedule`
			},
			'Aps/:planId/JobCards': {
				label: 'Production Schedule',
				href: (params: Record<string, string>) =>
					`Aps/${encodeURIComponent(params.planId ?? '')}/ProductionSchedule`
			},
			'Aps/:planId/JobCards/run/:runId': {
				label: 'Production Schedule',
				href: (params: Record<string, string>) =>
					`Aps/${encodeURIComponent(params.planId ?? '')}/ProductionSchedule`
			}
		},
		resolveParamName: (paramName: string, paramValue: string) => {
			if (paramName === 'planId') {
				return getManufacturingPlanLabel(paramValue);
			}
			if (paramName === 'runId') {
				return getScheduleRunLabel(paramValue);
			}
			if (paramName === 'jobId') {
				return getJobCardLabel(paramValue);
			}
			return baseMenu.resolveParamName?.(paramName, paramValue) ?? paramValue;
		},
		resolveRouteTitle: (pattern: string, params: Record<string, string>) => {
			if (pattern === 'Sheet/:planId/:month') {
				const id = params.planId ? decodeURIComponent(params.planId) : '';
				const month = params.month ? decodeURIComponent(params.month) : '';
				const label = getPlanningSheetPlanLabel(id);
				return month ? `${label} · ${month}` : label;
			}
			if (pattern === 'Aps/:planId/Review' || pattern === 'Aps/:planId/Setup') {
				return pattern.endsWith('Review') ? 'Review Input' : 'Schedule Setup';
			}
			if (pattern === 'Aps/:planId/ProductionSchedule') return 'Production Schedule';
			if (pattern === 'Aps/:planId/ProductionSchedule/:runId' && params.runId) {
				return getScheduleRunLabel(params.runId);
			}
			if (pattern === 'Aps/:planId/Runs' || pattern === 'ApsRuns/:planId') return 'All Runs';
			if (pattern === 'Aps/:planId/JobCards/:jobId' && params.jobId) {
				return getJobCardLabel(params.jobId);
			}
			return baseMenu.resolveRouteTitle?.(pattern, params);
		},
		postProcessBreadcrumbs: (
			crumbs: Array<{ label: string; href?: string; clickable?: boolean }>,
			pattern: string,
			params: Record<string, string>
		) => {
			if (pattern === 'Sheet/:planId/:month') {
				const id = params.planId ? decodeURIComponent(params.planId) : '';
				const month = params.month ? decodeURIComponent(params.month) : '';
				const sheetLabel = getPlanningSheetPlanLabel(id);
				return [
					{ label: 'Plans', href: 'Home', clickable: true },
					{ label: month ? `${sheetLabel} · ${month}` : sheetLabel, clickable: false }
				];
			}

			if (pattern === 'Aps/:planId/ProductionSchedule/:runId' && params.planId && params.runId) {
				const planId = params.planId;
				return [
					{ label: 'APS Runs', href: 'ApsRuns', clickable: true },
					{
						label: getManufacturingPlanLabel(planId),
						href: `Aps/${encodeURIComponent(planId)}/Runs`,
						clickable: true
					},
					{ label: getScheduleRunLabel(params.runId), href: '', clickable: false }
				];
			}

			if (pattern === 'Aps/:planId/JobCards/:jobId' && params.planId && params.jobId) {
				const planId = params.planId;
				return [
					{ label: 'APS Runs', href: 'ApsRuns', clickable: true },
					{
						label: getManufacturingPlanLabel(planId),
						href: `Aps/${encodeURIComponent(planId)}/Runs`,
						clickable: true
					},
					{
						label: 'Production Schedule',
						href: `Aps/${encodeURIComponent(planId)}/ProductionSchedule`,
						clickable: true
					},
					{
						label: 'Job Cards',
						href: `Aps/${encodeURIComponent(planId)}/JobCards`,
						clickable: true
					},
					{ label: getJobCardLabel(params.jobId), href: '', clickable: false }
				];
			}

			if (pattern.startsWith('Aps/:planId') && params.planId) {
				const planId = params.planId;
				const planLabel = getManufacturingPlanLabel(planId);
				const withoutDupHome = crumbs.filter((c) => c.href !== 'Home' && c.label !== 'Plans');
				return [
					{ label: 'APS Runs', href: 'ApsRuns', clickable: true },
					{
						label: planLabel,
						href: `Aps/${encodeURIComponent(planId)}/Review`,
						clickable: true
					},
					...withoutDupHome.filter((c) => c.label !== planLabel)
				];
			}

			const processed = baseMenu.postProcessBreadcrumbs(crumbs, pattern, params);
			return processed.map((crumb) => {
				if (crumb.label === 'Manufacturing Plans' && crumb.href === 'Home') {
					return { ...crumb, label: 'Plans' };
				}
				return crumb;
			});
		}
	}
};
