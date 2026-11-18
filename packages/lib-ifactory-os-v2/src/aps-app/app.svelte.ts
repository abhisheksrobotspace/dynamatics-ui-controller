import Home from './routes/Home.svelte';
import CreateManufacturingPlan from './routes/CreateManufacturingPlan.svelte';
import ScheduleSetup from './routes/ScheduleSetup.svelte';
import ProductionSchedule from './routes/ProductionSchedule.svelte';
import ScheduleRuns from './routes/ScheduleRuns.svelte';
import ScheduleReport from './routes/ScheduleReport.svelte';
import MachinesReport from './routes/MachinesReport.svelte';
import JobCardsList from './routes/JobCardsList.svelte';
import JobCardDetail from './routes/JobCardDetail.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import {
	getManufacturingPlanLabel,
	ensureManufacturingPlanLabel
} from './lib/manufacturing-plans.js';
import { ensureScheduleRunLabel, getScheduleRunLabel } from './lib/schedule-runs.js';
import { ensureJobCardLabel, getJobCardLabel } from './lib/job-cards.api.js';

export const app = {
	appName: 'APS',
	appCode: 'APS',
	displayName: 'APS',
	dockColor: '#FF6C2E',
	icon: '/assets/icons/production-monitoring-system.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	routes: {
		Home: Home,
		'Home/Create': CreateManufacturingPlan,
		'Home/:planId': CreateManufacturingPlan,
		'Home/:planId/Setup': ScheduleSetup,
		// Review Input reuses ScheduleSetup route component.
		'Home/:planId/Review': ScheduleSetup,
		'Home/:planId/ProductionSchedule': ProductionSchedule,
		'Home/:planId/ProductionSchedule/:runId': ProductionSchedule,
		'Home/:planId/Runs': ScheduleRuns,
		'Home/:planId/Schedule': ScheduleReport,
		'Home/:planId/Machines': MachinesReport,
		// More-specific JobCards/run/:runId must be registered before JobCards/:jobId.
		'Home/:planId/JobCards/run/:runId': JobCardsList,
		'Home/:planId/JobCards': JobCardsList,
		'Home/:planId/JobCards/:jobId': JobCardDetail,
		'Reports/Machines': MachinesReport
	},
	menu: {
		prepareRoute: async (pattern: string, params: Record<string, string>, signal?: AbortSignal) => {
			const planId = params.planId?.trim();
			// Cold refresh / deep-link: resolve plan name before breadcrumbs (else UUID).
			if (planId && pattern.startsWith('Home/:planId')) {
				await ensureManufacturingPlanLabel(planId, signal);
			}
			const runId = params.runId?.trim();
			if (planId && runId && pattern === 'Home/:planId/ProductionSchedule/:runId') {
				await ensureScheduleRunLabel(runId, planId, signal);
			}
			const jobId = params.jobId?.trim();
			if (jobId && pattern === 'Home/:planId/JobCards/:jobId') {
				await ensureJobCardLabel(jobId, signal);
			}
		},
		routeTitles: {
			Home: 'Manufacturing Plans',
			'Home/Create': 'Create',
			'Home/:planId/Setup': 'Schedule Setup',
			'Home/:planId/Review': 'Review Input',
			'Home/:planId/ProductionSchedule': 'Production Schedule',
			// Intentionally omit ProductionSchedule/:runId — AppShell would push the same
			// "Production Schedule" label again (duplicate breadcrumb key crash).
			'Home/:planId/Runs': 'All Runs',
			'Home/:planId/Schedule': 'Schedule Report',
			'Home/:planId/Machines': 'Machines Report',
			'Home/:planId/JobCards': 'Job Cards',
			'Home/:planId/JobCards/run/:runId': 'Job Cards',
			// Intentionally omit JobCards/:jobId — AppShell would append a duplicate
			// "Job Card" crumb after the :jobId segment (see postProcessBreadcrumbs).
			'Reports/Machines': 'Machines'
		},
		breadcrumbParents: {
			'Home/:planId/Runs': {
				label: 'Schedule Setup',
				href: (params: Record<string, string>) =>
					`Home/${encodeURIComponent(params.planId ?? '')}/Setup`
			},
			'Home/:planId/Schedule': {
				label: 'Production Schedule',
				href: (params: Record<string, string>) =>
					`Home/${encodeURIComponent(params.planId ?? '')}/ProductionSchedule`
			},
			'Home/:planId/Machines': {
				label: 'Production Schedule',
				href: (params: Record<string, string>) =>
					`Home/${encodeURIComponent(params.planId ?? '')}/ProductionSchedule`
			},
			'Home/:planId/JobCards': {
				label: 'Production Schedule',
				href: (params: Record<string, string>) =>
					`Home/${encodeURIComponent(params.planId ?? '')}/ProductionSchedule`
			},
			'Home/:planId/JobCards/run/:runId': {
				label: 'Production Schedule',
				href: (params: Record<string, string>) =>
					`Home/${encodeURIComponent(params.planId ?? '')}/ProductionSchedule`
			},
			'Reports/Machines': {
				label: 'Reports',
				href: 'Reports/Machines'
			}
		},
		/**
		 * Rebuild trail for a specific run so we don't keep both the intermediate
		 * "Production Schedule" segment and a duplicate current title.
		 * Desired: Manufacturing Plans / {plan} / All Runs / v{N}
		 *
		 * Job card detail: Manufacturing Plans / {plan} / Production Schedule / Job Cards / {JC}
		 */
		postProcessBreadcrumbs: (
			crumbs: Array<{ label: string; href?: string; clickable?: boolean }>,
			pattern: string,
			params: Record<string, string>
		) => {
			if (pattern === 'Home/:planId/ProductionSchedule/:runId' && params.planId && params.runId) {
				const planId = params.planId;
				const planLabel = getManufacturingPlanLabel(planId);
				const runLabel = getScheduleRunLabel(params.runId);
				return [
					{ label: 'Manufacturing Plans', href: 'Home', clickable: true },
					{
						label: planLabel,
						href: `Home/${encodeURIComponent(planId)}`,
						clickable: true
					},
					{
						label: 'All Runs',
						href: `Home/${encodeURIComponent(planId)}/Runs`,
						clickable: true
					},
					{ label: runLabel, href: '', clickable: false }
				];
			}

			if (pattern === 'Home/:planId/JobCards/:jobId' && params.planId && params.jobId) {
				const planId = params.planId;
				const planLabel = getManufacturingPlanLabel(planId);
				const jobLabel = getJobCardLabel(params.jobId);
				return [
					{ label: 'Manufacturing Plans', href: 'Home', clickable: true },
					{
						label: planLabel,
						href: `Home/${encodeURIComponent(planId)}`,
						clickable: true
					},
					{
						label: 'Production Schedule',
						href: `Home/${encodeURIComponent(planId)}/ProductionSchedule`,
						clickable: true
					},
					{
						label: 'Job Cards',
						href: `Home/${encodeURIComponent(planId)}/JobCards`,
						clickable: true
					},
					{ label: jobLabel, href: '', clickable: false }
				];
			}

			return crumbs;
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
			return paramValue;
		},
		resolveRouteTitle: (pattern: string, params: Record<string, string>) => {
			if (pattern === 'Home/:planId' && params.planId) {
				return getManufacturingPlanLabel(params.planId);
			}
			if (
				(pattern === 'Home/:planId/Setup' || pattern === 'Home/:planId/Review') &&
				params.planId
			) {
				return pattern === 'Home/:planId/Review' ? 'Review Input' : 'Schedule Setup';
			}
			if (pattern === 'Home/:planId/ProductionSchedule' && params.planId) {
				return 'Production Schedule';
			}
			if (pattern === 'Home/:planId/ProductionSchedule/:runId' && params.runId) {
				return getScheduleRunLabel(params.runId);
			}
			if (pattern === 'Home/:planId/Runs' && params.planId) {
				return 'All Runs';
			}
			if (pattern === 'Home/:planId/Schedule' && params.planId) {
				return 'Schedule Report';
			}
			if (pattern === 'Home/:planId/Machines' && params.planId) {
				return 'Machines Report';
			}
			if (
				(pattern === 'Home/:planId/JobCards' || pattern === 'Home/:planId/JobCards/run/:runId') &&
				params.planId
			) {
				return 'Job Cards';
			}
			if (pattern === 'Home/:planId/JobCards/:jobId' && params.jobId) {
				return getJobCardLabel(params.jobId);
			}
			if (pattern === 'Reports/Machines') {
				return 'Machines';
			}
			return undefined;
		}
	}
};
