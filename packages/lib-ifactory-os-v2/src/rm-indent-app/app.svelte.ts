import Home from './routes/Home.svelte';
import ManufacturingPlansHome from './routes/ManufacturingPlansHome.svelte';
import ManufacturingPlan from './routes/ManufacturingPlan.svelte';
import StockRegister from './routes/StockRegister.svelte';
import Dashboard from './routes/Dashboard.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import GroupedAssignAndLock from './routes/GroupedAssignAndLock.svelte';
import RaiseIndentSection from './routes/RaiseIndentSection.svelte';
import Indents from './routes/Indents.svelte';
import PlansHome from './routes/PlansHome.svelte';
import PlanSheet from './routes/PlanSheet.svelte';
import SelectSectionsFromPlan from './routes/SelectSectionsFromPlan.svelte';
import CreateIndentFromPlan from './routes/CreateIndentFromPlan.svelte';
import GenerateIndent from './routes/GenerateIndent.svelte';
import IndentDetailEntry from './routes/IndentDetailEntry.svelte';
import StockAssignmentHome from './routes/StockAssignmentHome.svelte';
import CuttingPlanCreateSections from '../cutting-plan-app/routes/CuttingPlanCreateSections.svelte';
import CuttingPlanCreateStockLengths from '../cutting-plan-app/routes/CuttingPlanCreateStockLengths.svelte';
import CuttingPlanRuns from '../cutting-plan-app/routes/CuttingPlanRuns.svelte';
import CuttingPlanResultsSummary from '../cutting-plan-app/routes/CuttingPlanResultsSummary.svelte';
import CuttingPlanPlanner from '../cutting-plan-app/routes/CuttingPlanPlanner.svelte';
import {
	ensureIndentLabel,
	getIndentLabel,
	readCreateIndentFromPlan,
	readCreateIndentSelection,
	setIndentLabel
} from './lib/indent-routes.js';
import {
	CUTTING_PLAN_REPLAN_ROUTE_TITLES,
	cuttingPlanReplanWizardCrumbs,
	getProjectLabel as getPlanningMenuProjectLabel
} from './lib/planning-app-menu.js';
import { peekCuttingPlanReturnHash } from '../cutting-plan-app/lib/cutting-plan/cutting-plan-host.js';
import { getUiIndent, isUiIndentId } from './lib/ui-indent.store.js';
import {
	ensurePlanningSheetPlanLabel,
	getPlanningSheetPlanLabel
} from '../central-planning-app/lib/planning-sheet.store.js';
import { apiClient } from '../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../lib/api/types.js';
import { shortNameFromMetadata } from '../project-management-app/lib/projects/types.js';
import { SvelteMap } from 'svelte/reactivity';

const _projectLabelCache = new SvelteMap<string, string>();

/** Breadcrumb label: short name only (not full project title). */
function _buildProjectLabel(project: {
	project_id: string;
	name?: string;
	metadata?: Record<string, unknown>;
}): string {
	const short = shortNameFromMetadata(project.metadata);
	if (short) return short;
	const wo =
		typeof project.metadata?.work_order_no === 'string'
			? project.metadata.work_order_no.trim()
			: '';
	if (wo) return wo;
	return (project.name ?? '').trim() || project.project_id;
}

async function ensureProjectLabel(projectId: string, signal?: AbortSignal): Promise<void> {
	if (_projectLabelCache.has(projectId)) return;
	try {
		type ProjectRow = { project_id: string; name?: string; metadata?: Record<string, unknown> };
		const envelope = await apiClient.get<ApiEnvelope<ProjectRow[]>>(
			apiClient.datahub(
				`proj_projects?project_id__in=${encodeURIComponent(projectId)}&select=project_id,name,metadata&limit=1`
			),
			{ signal }
		);
		const rows = rowsFromEnvelope<ProjectRow>(envelope.data);
		if (rows[0]) _projectLabelCache.set(projectId, _buildProjectLabel(rows[0]));
	} catch {
		// falls back to raw projectId
	}
}

export function getProjectLabel(projectId: string): string | undefined {
	return _projectLabelCache.get(projectId) ?? getPlanningMenuProjectLabel(projectId);
}

const cuttingPlanReplanRoutes = {
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

/** Root crumbs for in-app replan when launched from Stock Assignment Lock (or Assign & Lock). */
function replanHostRootCrumbs(): Array<{ label: string; href?: string; clickable?: boolean }> {
	const returnHash = peekCuttingPlanReturnHash() ?? '';
	if (returnHash.includes('/StockAssignment/Lock')) {
		return [
			{ label: 'Stock Assignment', href: 'StockAssignment', clickable: true },
			{ label: 'Lock', href: 'StockAssignment/Lock', clickable: true }
		];
	}
	const assignMatch = /#\/RMI\/(ManufacturingPlan\/[^/]+\/GroupedAssignAndLock\/[^/?#]+)/.exec(
		returnHash
	);
	if (assignMatch?.[1]) {
		return [
			{ label: 'Manufacturing Plans', href: 'ManufacturingPlans', clickable: true },
			{ label: 'Assign & Lock', href: assignMatch[1], clickable: true }
		];
	}
	return [
		{ label: 'Stock Assignment', href: 'StockAssignment', clickable: true },
		{ label: 'Lock', href: 'StockAssignment/Lock', clickable: true }
	];
}

export const app = {
	appName: 'RMI',
	appCode: 'RMI',
	displayName: 'RM & Inventory',
	dockColor: '#14B8A6',
	icon: '/assets/icons/asset-manager.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	routes: {
		Home,
		// Old Manufacturing Plans home — kept reachable by URL, hidden from sidebar.
		ManufacturingPlans: ManufacturingPlansHome,
		'StockRegister/:projectId': StockRegister,
		'ManufacturingPlan/:planId': ManufacturingPlan,
		'ManufacturingPlan/:planId/StockRegister/:projectId': StockRegister,
		'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId': GroupedAssignAndLock,
		'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndent': RaiseIndentSection,
		'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndentSection/:section/:lengthMm':
			RaiseIndentSection,
		Dashboard,
		Plans: PlansHome,
		'Plans/:planId': PlanSheet,
		Indents,
		// Exact paths before :indentId so literals are not captured as an id.
		'Indents/Select': SelectSectionsFromPlan,
		'Indents/Create': CreateIndentFromPlan,
		'Indents/Generate': GenerateIndent,
		'Indents/:indentId': IndentDetailEntry,
		StockAssignment: StockAssignmentHome,
		'StockAssignment/Lock': GroupedAssignAndLock,
		...cuttingPlanReplanRoutes
	},
	menu: {
		prepareRoute: async (pattern: string, params: Record<string, string>, signal?: AbortSignal) => {
			if (params.projectId) {
				await ensureProjectLabel(decodeURIComponent(params.projectId), signal);
			}
			if (pattern === 'Plans/:planId' && params.planId) {
				await ensurePlanningSheetPlanLabel(decodeURIComponent(params.planId), signal);
			}
			if (pattern === 'Indents/:indentId' && params.indentId) {
				const id = decodeURIComponent(params.indentId);
				if (isUiIndentId(id)) {
					const ui = getUiIndent(id);
					setIndentLabel(id, ui ? `#${ui.indentNo} - UI` : id);
				} else if (!getIndentLabel(id)) {
					await ensureIndentLabel(id, signal);
				}
			}
		},
		routeTitles: {
			Home: 'Stock Available',
			ManufacturingPlans: 'Manufacturing Plans',
			// Intentionally omit StockRegister/:projectId — AppShell would append
			// "Stock Register" after the project param; we stop at the project name.
			'ManufacturingPlan/:planId/StockRegister/:projectId': 'Stock Register',
			'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId': 'Assign & Lock',
			'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndent': 'Create Indent',
			'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndentSection/:section/:lengthMm':
				'Create Indent',
			Dashboard: 'Dashboard',
			Plans: 'Plans',
			Indents: 'Indents',
			'Indents/Select': 'Raise Indent',
			'Indents/Create': 'Create Indent',
			'Indents/Generate': 'Generate Indent',
			StockAssignment: 'Stock Assignment',
			'StockAssignment/Lock': 'Lock',
			...CUTTING_PLAN_REPLAN_ROUTE_TITLES
		},
		breadcrumbParents: {
			'ManufacturingPlan/:planId': { label: 'Manufacturing Plans', href: 'ManufacturingPlans' }
		},
		postProcessBreadcrumbs: (
			crumbs: Array<{ label: string; href?: string; clickable?: boolean }>,
			pattern: string,
			params: Record<string, string>
		) => {
			if (pattern in CUTTING_PLAN_REPLAN_ROUTE_TITLES) {
				return [...replanHostRootCrumbs(), ...cuttingPlanReplanWizardCrumbs(pattern, params)];
			}
			if (pattern === 'StockAssignment') {
				return [{ label: 'Stock Assignment', clickable: false }];
			}
			if (pattern === 'StockAssignment/Lock') {
				return [
					{ label: 'Stock Assignment', href: 'StockAssignment', clickable: true },
					{ label: 'Lock', clickable: false }
				];
			}
			if (pattern === 'Plans/:planId') {
				const id = params.planId ? decodeURIComponent(params.planId) : '';
				const sheetLabel = getPlanningSheetPlanLabel(id);
				return [
					{ label: 'Plans', href: 'Plans', clickable: true },
					{ label: sheetLabel, clickable: false }
				];
			}
			if (pattern === 'Indents/Select' || pattern === 'Indents/Create') {
				const scope =
					readCreateIndentFromPlan() ??
					(pattern === 'Indents/Create' ? readCreateIndentSelection() : null);
				const planId = scope?.planId ?? '';
				const planLabel = planId ? getPlanningSheetPlanLabel(planId) : '';
				const crumbs: Array<{ label: string; href?: string; clickable?: boolean }> = [
					{ label: 'Plans', href: 'Plans', clickable: true }
				];
				if (planId) {
					crumbs.push({
						label: planLabel,
						href: `Plans/${encodeURIComponent(planId)}`,
						clickable: true
					});
				}
				if (pattern === 'Indents/Create') {
					crumbs.push({
						label: 'Raise Indent',
						href: 'Indents/Select',
						clickable: true
					});
				}
				crumbs.push({
					label: pattern === 'Indents/Select' ? 'Raise Indent' : 'Create Indent',
					clickable: false
				});
				return crumbs;
			}
			const raiseIndentBulkPattern =
				'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndent';
			const raiseIndentPattern =
				'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndentSection/:section/:lengthMm';
			if (pattern === raiseIndentPattern || pattern === raiseIndentBulkPattern) {
				const planId = decodeURIComponent(params.planId ?? '');
				const projectId = decodeURIComponent(params.projectId ?? '');
				const section = params.section ? decodeURIComponent(params.section) : '';
				const lengthMm = params.lengthMm ?? '';
				const enc = (value: string) => encodeURIComponent(value);
				const projectLabel = getProjectLabel(projectId) ?? projectId;
				const assignHref = `ManufacturingPlan/${enc(planId)}/GroupedAssignAndLock/${enc(projectId)}`;
				const raiseHref = section
					? `${assignHref}/RaiseIndentSection/${enc(section)}/${lengthMm}`
					: `${assignHref}/RaiseIndent`;
				return [
					{ label: 'Manufacturing Plans', href: 'ManufacturingPlans', clickable: true },
					{ label: planId, href: `ManufacturingPlan/${enc(planId)}`, clickable: true },
					{ label: projectLabel, href: `ManufacturingPlan/${enc(planId)}`, clickable: true },
					{ label: 'Assign & Lock', href: assignHref, clickable: true },
					{ label: section || 'Create Indent', href: raiseHref, clickable: false }
				];
			}

			if (pattern === 'StockRegister/:projectId') {
				const projectId = decodeURIComponent(params.projectId ?? '');
				const projectLabel = getProjectLabel(projectId) ?? projectId;
				return [
					{ label: 'Stock Available', href: 'Home', clickable: true },
					{ label: projectLabel, clickable: false }
				];
			}

			if (pattern === 'Indents/Generate') {
				return [
					{ label: 'Indents', href: 'Indents', clickable: true },
					{ label: 'Generate Indent', clickable: false }
				];
			}

			if (pattern === 'Indents/:indentId' && params.indentId) {
				return [
					{ label: 'Indents', href: 'Indents', clickable: true },
					{ label: getIndentLabel(params.indentId) ?? params.indentId, clickable: false }
				];
			}

			// For nested ManufacturingPlan sub-routes, prepend "Manufacturing Plans"
			// (old home is ManufacturingPlans — no longer the app Home).
			const nestedPrefixes = [
				'ManufacturingPlan/:planId/StockRegister/:projectId',
				'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId',
				raiseIndentBulkPattern,
				raiseIndentPattern
			];
			if (nestedPrefixes.includes(pattern) && crumbs[0]?.label !== 'Manufacturing Plans') {
				crumbs.unshift({
					label: 'Manufacturing Plans',
					href: 'ManufacturingPlans',
					clickable: true
				});
			}
			return crumbs;
		},
		resolveParamName: (paramName: string, paramValue: string) => {
			if (paramName === 'planId') {
				return decodeURIComponent(paramValue);
			}
			if (paramName === 'projectId') {
				return getProjectLabel(decodeURIComponent(paramValue)) ?? decodeURIComponent(paramValue);
			}
			if (paramName === 'indentId') {
				return getIndentLabel(paramValue) ?? paramValue;
			}
			return paramValue;
		},
		resolveRouteTitle: (pattern: string, params: Record<string, string>) => {
			if (pattern === 'StockAssignment') {
				return [{ label: 'Stock Assignment', clickable: false }];
			}
			if (pattern === 'StockAssignment/Lock') {
				return [
					{ label: 'Stock Assignment', href: 'StockAssignment', clickable: true },
					{ label: 'Lock', clickable: false }
				];
			}
			if (pattern === 'Plans/:planId') {
				const id = params.planId ? decodeURIComponent(params.planId) : '';
				return getPlanningSheetPlanLabel(id);
			}
			if (pattern === 'StockRegister/:projectId' && params.projectId) {
				const projectId = decodeURIComponent(params.projectId);
				return getProjectLabel(projectId) ?? projectId;
			}
			if (pattern === 'Indents/Select') {
				return 'Raise Indent';
			}
			if (pattern === 'Indents/Create') {
				return 'Create Indent';
			}
			if (pattern === 'Indents/Generate') {
				return 'Generate Indent';
			}
			if (pattern === 'Indents/:indentId' && params.indentId) {
				return getIndentLabel(params.indentId) ?? 'Indent';
			}
			return undefined;
		}
	}
};
