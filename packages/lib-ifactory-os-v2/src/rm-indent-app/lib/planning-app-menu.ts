/**
 * Shared menu (breadcrumbs / titles) for Central Planning & Shop Floor Planning shells.
 * Home = Manufacturing Plans list.
 */

import { SvelteMap } from 'svelte/reactivity';
import { getIndentLabel, setIndentLabel } from './indent-routes.js';
import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { shortNameFromMetadata } from '../../project-management-app/lib/projects/types.js';

const projectLabelCache = new SvelteMap<string, string>();

function buildProjectLabel(project: {
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
	if (projectLabelCache.has(projectId)) return;
	try {
		type ProjectRow = { project_id: string; name?: string; metadata?: Record<string, unknown> };
		const envelope = await apiClient.get<ApiEnvelope<ProjectRow[]>>(
			apiClient.datahub(
				`proj_projects?project_id__in=${encodeURIComponent(projectId)}&select=project_id,name,metadata&limit=1`
			),
			{ signal }
		);
		const rows = rowsFromEnvelope<ProjectRow>(envelope.data);
		if (rows[0]) projectLabelCache.set(projectId, buildProjectLabel(rows[0]));
	} catch {
		// falls back to raw projectId
	}
}

function getProjectLabel(projectId: string): string | undefined {
	return projectLabelCache.get(projectId);
}

export { getProjectLabel };

/** Cutting-plan wizard routes hosted inside planning / RMI shells (not the CuttingPlan dock app). */
export const CUTTING_PLAN_REPLAN_ROUTE_TITLES: Record<string, string> = {
	'Home/:projectId/Towers/:towerId/Boms/:bomId/Sections': 'Select Sections',
	'Home/:projectId/Towers/:towerId/Boms/:bomId/StockLengths': 'Stock Lengths',
	'Home/:projectId/Towers/:towerId/Boms/:bomId/Runs': 'Plan Runs',
	'Home/:projectId/Towers/:towerId/Boms/:bomId/Runs/:runId/Summary': 'Results',
	'Home/:projectId/Towers/:towerId/Boms/:bomId/Runs/:runId/Plan': 'RM Required',
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/Sections': 'Select Sections',
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/StockLengths': 'Stock Lengths',
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/Runs': 'Plan Runs',
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/Runs/:runId/Summary': 'Results',
	'Home/:projectId/Stubs/:stubId/Boms/:bomId/Runs/:runId/Plan': 'RM Required'
};

const CP_ROUTE_TITLES = CUTTING_PLAN_REPLAN_ROUTE_TITLES;

export type BreadcrumbCrumb = { label: string; href?: string; clickable?: boolean };

/** Wizard step crumbs after a host-specific root (e.g. Stock Assignment → Lock). */
export function cuttingPlanReplanWizardCrumbs(
	pattern: string,
	params: Record<string, string>
): BreadcrumbCrumb[] {
	const title = CP_ROUTE_TITLES[pattern] ?? 'Cutting Plan';
	const structureSeg = params.towerId ? `Towers/${params.towerId}` : `Stubs/${params.stubId}`;
	const bomBase = `Home/${params.projectId}/${structureSeg}/Boms/${params.bomId}`;
	if (pattern.endsWith('Sections')) {
		return [{ label: 'Select Sections', href: `${bomBase}/Sections`, clickable: false }];
	}
	if (pattern.endsWith('StockLengths')) {
		return [
			{ label: 'Select Sections', href: `${bomBase}/Sections`, clickable: true },
			{ label: 'Stock Lengths', href: `${bomBase}/StockLengths`, clickable: false }
		];
	}
	if (pattern.endsWith('/Runs')) {
		return [
			{ label: 'Select Sections', href: `${bomBase}/Sections`, clickable: true },
			{ label: 'Plan Runs', href: `${bomBase}/Runs`, clickable: false }
		];
	}
	if (pattern.endsWith('/Summary')) {
		return [
			{ label: 'Select Sections', href: `${bomBase}/Sections`, clickable: true },
			{
				label: 'Results',
				href: `${bomBase}/Runs/${params.runId}/Summary`,
				clickable: false
			}
		];
	}
	if (pattern.endsWith('/Plan')) {
		return [
			{ label: 'Select Sections', href: `${bomBase}/Sections`, clickable: true },
			{
				label: 'Results',
				href: `${bomBase}/Runs/${params.runId}/Summary`,
				clickable: true
			},
			{
				label: 'RM Required',
				href: `${bomBase}/Runs/${params.runId}/Plan`,
				clickable: false
			}
		];
	}
	return [{ label: title, clickable: false }];
}

export type PlanningMenuOptions = {
	/** Include Raise Indent / Indent detail titles (Central Planning). */
	includeRaiseIndent?: boolean;
	/** Include cutting-plan replan wizard titles (Shop Floor Planning). */
	includeCuttingPlanReplan?: boolean;
};

export function createPlanningMenu(options: PlanningMenuOptions = {}) {
	const includeRaiseIndent = options.includeRaiseIndent ?? false;
	const includeCuttingPlanReplan = options.includeCuttingPlanReplan ?? false;

	const routeTitles: Record<string, string> = {
		Home: 'Manufacturing Plans',
		'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId': includeRaiseIndent
			? 'Raise Indent'
			: 'Assign & Lock'
	};
	if (includeRaiseIndent) {
		routeTitles['ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndent'] =
			'Create Indent';
		routeTitles[
			'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndentSection/:section/:lengthMm'
		] = 'Create Indent';
		routeTitles['ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/Indents'] = 'Indents';
		routeTitles['ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/Indents/:indentId'] =
			'Indent';
	}
	if (includeCuttingPlanReplan) {
		Object.assign(routeTitles, CP_ROUTE_TITLES);
	}

	return {
		prepareRoute: async (pattern: string, params: Record<string, string>, signal?: AbortSignal) => {
			if (params.projectId) {
				await ensureProjectLabel(decodeURIComponent(params.projectId), signal);
			}
			if (
				(pattern === 'Indents/:indentId' ||
					pattern ===
						'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/Indents/:indentId') &&
				params.indentId &&
				!getIndentLabel(params.indentId)
			) {
				setIndentLabel(params.indentId, params.indentId);
			}
		},
		routeTitles,
		breadcrumbParents: {
			'ManufacturingPlan/:planId': { label: 'Manufacturing Plans', href: 'Home' }
		},
		postProcessBreadcrumbs: (
			crumbs: Array<{ label: string; href?: string; clickable?: boolean }>,
			pattern: string,
			params: Record<string, string>
		) => {
			const raiseIndentBulkPattern =
				'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndent';
			const raiseIndentPattern =
				'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/RaiseIndentSection/:section/:lengthMm';
			const projectIndentsPattern =
				'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/Indents';
			const projectIndentDetailPattern =
				'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/Indents/:indentId';

			if (includeRaiseIndent && pattern === projectIndentsPattern) {
				const planId = decodeURIComponent(params.planId ?? '');
				const projectId = decodeURIComponent(params.projectId ?? '');
				const enc = (value: string) => encodeURIComponent(value);
				const projectLabel = getProjectLabel(projectId) ?? projectId;
				return [
					{ label: 'Manufacturing Plans', href: 'Home', clickable: true },
					{ label: planId, href: `ManufacturingPlan/${enc(planId)}`, clickable: true },
					{ label: projectLabel, href: `ManufacturingPlan/${enc(planId)}`, clickable: true },
					{ label: 'Indents', clickable: false }
				];
			}

			if (includeRaiseIndent && pattern === projectIndentDetailPattern) {
				const planId = decodeURIComponent(params.planId ?? '');
				const projectId = decodeURIComponent(params.projectId ?? '');
				const indentId = params.indentId ?? '';
				const enc = (value: string) => encodeURIComponent(value);
				const projectLabel = getProjectLabel(projectId) ?? projectId;
				const indentLabel = getIndentLabel(indentId) ?? indentId;
				const indentsHref = `ManufacturingPlan/${enc(planId)}/GroupedAssignAndLock/${enc(projectId)}/Indents`;
				return [
					{ label: 'Manufacturing Plans', href: 'Home', clickable: true },
					{ label: planId, href: `ManufacturingPlan/${enc(planId)}`, clickable: true },
					{ label: projectLabel, href: `ManufacturingPlan/${enc(planId)}`, clickable: true },
					{ label: 'Indents', href: indentsHref, clickable: true },
					{ label: indentLabel, clickable: false }
				];
			}

			if (
				includeRaiseIndent &&
				(pattern === raiseIndentPattern || pattern === raiseIndentBulkPattern)
			) {
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
				const assignLockLabel = includeRaiseIndent ? 'Raise Indent' : 'Assign & Lock';
				return [
					{ label: 'Manufacturing Plans', href: 'Home', clickable: true },
					{ label: planId, href: `ManufacturingPlan/${enc(planId)}`, clickable: true },
					{ label: projectLabel, href: `ManufacturingPlan/${enc(planId)}`, clickable: true },
					{ label: assignLockLabel, href: assignHref, clickable: true },
					{ label: section || 'Create Indent', href: raiseHref, clickable: false }
				];
			}

			if (includeCuttingPlanReplan && pattern in CP_ROUTE_TITLES) {
				const projectId = decodeURIComponent(params.projectId ?? '');
				const projectLabel = getProjectLabel(projectId) ?? projectId;
				return [
					{ label: 'Manufacturing Plans', href: 'Home', clickable: true },
					{ label: projectLabel, href: 'Home', clickable: true },
					...cuttingPlanReplanWizardCrumbs(pattern, params)
				];
			}

			const nestedPrefixes = [
				'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId',
				...(includeRaiseIndent
					? [
							raiseIndentBulkPattern,
							raiseIndentPattern,
							projectIndentsPattern,
							projectIndentDetailPattern
						]
					: [])
			];
			if (nestedPrefixes.includes(pattern) && crumbs[0]?.label !== 'Manufacturing Plans') {
				crumbs.unshift({ label: 'Manufacturing Plans', href: 'Home', clickable: true });
			}
			return crumbs;
		},
		resolveParamName: (paramName: string, paramValue: string) => {
			if (paramName === 'planId') return decodeURIComponent(paramValue);
			if (paramName === 'projectId') {
				return getProjectLabel(decodeURIComponent(paramValue)) ?? decodeURIComponent(paramValue);
			}
			if (paramName === 'indentId') {
				return getIndentLabel(paramValue) ?? paramValue;
			}
			return paramValue;
		},
		resolveRouteTitle: (pattern: string, params: Record<string, string>) => {
			if (
				(pattern === 'Indents/:indentId' ||
					pattern ===
						'ManufacturingPlan/:planId/GroupedAssignAndLock/:projectId/Indents/:indentId') &&
				params.indentId
			) {
				return getIndentLabel(params.indentId) ?? 'Indent';
			}
			return undefined;
		}
	};
}
