import { SvelteMap } from 'svelte/reactivity';
import Home from './routes/Home.svelte';
import ProjectHome from './routes/ProjectHome.svelte';
import Towers from './routes/Towers.svelte';
import Stubs from './routes/Stubs.svelte';
import Subtypes from './routes/Subtypes.svelte';
import Versions from './routes/Versions.svelte';
import CuttingPlanCreateSections from './routes/CuttingPlanCreateSections.svelte';
import CuttingPlanCreateStockLengths from './routes/CuttingPlanCreateStockLengths.svelte';
import CuttingPlanRuns from './routes/CuttingPlanRuns.svelte';
import CuttingPlanResultsSummary from './routes/CuttingPlanResultsSummary.svelte';
import CuttingPlanPlanner from './routes/CuttingPlanPlanner.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import { apiClient } from '../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../lib/api/types.js';
import { ocrProjectDisplayLabel } from '../ocr-app/lib/ocr-drawings.api.js';

const projectLabelCache = new SvelteMap<string, string>();
const structureLabelCache = new SvelteMap<string, string>();
const lineageLabelCache = new SvelteMap<string, string>();
/** Breadcrumb label for a BOM version — `v{n}` only. */
const bomLabelCache = new SvelteMap<string, string>();
/** `bom_id` → `bom_lineage_id` so CP pages keep the subtype crumb. */
const bomLineageByBomId = new SvelteMap<string, string>();

async function ensureProjectLabel(projectId: string, signal?: AbortSignal): Promise<void> {
	if (projectLabelCache.has(projectId)) return;
	try {
		const envelope = await apiClient.get<
			ApiEnvelope<Array<{ project_id: string; name?: string; metadata?: Record<string, unknown> }>>
		>(
			apiClient.datahub(
				`proj_projects?project_id=${encodeURIComponent(projectId)}&select=project_id,name,metadata&limit=1`
			),
			{ signal }
		);
		const row = rowsFromEnvelope<{
			project_id: string;
			name?: string;
			metadata?: Record<string, unknown>;
		}>(envelope.data)[0];
		if (row) projectLabelCache.set(projectId, ocrProjectDisplayLabel(row));
	} catch {
		// fall back to id
	}
}

async function ensureStructureLabel(structureId: string, signal?: AbortSignal): Promise<void> {
	if (structureLabelCache.has(structureId)) return;
	try {
		const envelope = await apiClient.get<
			ApiEnvelope<Array<{ structure_id: string; name: string }>>
		>(
			apiClient.datahub(
				`proj_structures?structure_id=${encodeURIComponent(structureId)}&select=structure_id,name&limit=1`
			),
			{ signal }
		);
		const row = rowsFromEnvelope<{ structure_id: string; name: string }>(envelope.data)[0];
		if (row) structureLabelCache.set(structureId, row.name);
	} catch {
		// fall back to id
	}
}

async function ensureLineageLabel(lineageId: string, signal?: AbortSignal): Promise<void> {
	if (lineageLabelCache.has(lineageId)) return;
	try {
		const envelope = await apiClient.get<
			ApiEnvelope<Array<{ bom_lineage_id?: string; bom_name: string }>>
		>(
			apiClient.datahub(
				`proj_boms?bom_lineage_id=${encodeURIComponent(lineageId)}&select=bom_lineage_id,bom_name&limit=1`
			),
			{ signal }
		);
		const row = rowsFromEnvelope<{ bom_lineage_id?: string; bom_name: string }>(envelope.data)[0];
		if (row) lineageLabelCache.set(lineageId, row.bom_name);
	} catch {
		// fall back to id
	}
}

async function ensureBomLabel(bomId: string, signal?: AbortSignal): Promise<void> {
	if (bomLabelCache.has(bomId)) return;
	try {
		const envelope = await apiClient.get<
			ApiEnvelope<
				Array<{
					bom_id: string;
					bom_name: string;
					version?: number;
					bom_lineage_id?: string;
				}>
			>
		>(
			apiClient.datahub(
				`proj_boms?bom_id=${encodeURIComponent(bomId)}&select=bom_id,bom_name,version,bom_lineage_id&limit=1`
			),
			{ signal }
		);
		const row = rowsFromEnvelope<{
			bom_id: string;
			bom_name: string;
			version?: number;
			bom_lineage_id?: string;
		}>(envelope.data)[0];
		if (row) {
			const version = row.version ?? 1;
			bomLabelCache.set(bomId, `v${version}`);
			const lineageId = row.bom_lineage_id ?? row.bom_id;
			bomLineageByBomId.set(bomId, lineageId);
			if (!lineageLabelCache.has(lineageId)) {
				lineageLabelCache.set(lineageId, row.bom_name);
			}
		}
	} catch {
		// fall back to id
	}
}

function towerBomsPattern(suffix: string): string {
	return `Home/:projectId/Towers/:towerId/Boms${suffix}`;
}
function stubBomsPattern(suffix: string): string {
	return `Home/:projectId/Stubs/:stubId/Boms${suffix}`;
}

const CP_ROUTE_TITLES: Record<string, string> = {
	[towerBomsPattern('/:bomId/Sections')]: 'Select Sections',
	[stubBomsPattern('/:bomId/Sections')]: 'Select Sections',
	[towerBomsPattern('/:bomId/StockLengths')]: 'Stock Lengths',
	[stubBomsPattern('/:bomId/StockLengths')]: 'Stock Lengths',
	[towerBomsPattern('/:bomId/Runs')]: 'Plan Runs',
	[stubBomsPattern('/:bomId/Runs')]: 'Plan Runs',
	[towerBomsPattern('/:bomId/Runs/:runId/Summary')]: 'Results',
	[stubBomsPattern('/:bomId/Runs/:runId/Summary')]: 'Results',
	[towerBomsPattern('/:bomId/Runs/:runId/Plan')]: 'RM Required',
	[stubBomsPattern('/:bomId/Runs/:runId/Plan')]: 'RM Required'
};

const browseRouteTitles: Record<string, string> = {
	Home: 'Projects',
	'Home/:projectId/Towers': 'Tower Types',
	'Home/:projectId/Stubs': 'Stubs',
	...CP_ROUTE_TITLES
};

const cuttingPlanRoutes = {
	[towerBomsPattern('/:bomId/Sections')]: CuttingPlanCreateSections,
	[stubBomsPattern('/:bomId/Sections')]: CuttingPlanCreateSections,
	[towerBomsPattern('/:bomId/StockLengths')]: CuttingPlanCreateStockLengths,
	[stubBomsPattern('/:bomId/StockLengths')]: CuttingPlanCreateStockLengths,
	[towerBomsPattern('/:bomId/Runs')]: CuttingPlanRuns,
	[stubBomsPattern('/:bomId/Runs')]: CuttingPlanRuns,
	[towerBomsPattern('/:bomId/Runs/:runId/Summary')]: CuttingPlanResultsSummary,
	[stubBomsPattern('/:bomId/Runs/:runId/Summary')]: CuttingPlanResultsSummary,
	[towerBomsPattern('/:bomId/Runs/:runId/Plan')]: CuttingPlanPlanner,
	[stubBomsPattern('/:bomId/Runs/:runId/Plan')]: CuttingPlanPlanner
};

export const app = {
	appName: 'CuttingPlan',
	appCode: 'CUT',
	displayName: 'Cutting Plan',
	dockColor: '#3B82F6',
	icon: '/assets/icons/admin-control-panel.svg',
	topbarComponent: TopbarControls,
	sidebar: AppSidebar,
	routes: {
		Home,
		'Home/:projectId': ProjectHome,
		'Home/:projectId/Towers': Towers,
		'Home/:projectId/Stubs': Stubs,
		[towerBomsPattern('')]: Subtypes,
		[stubBomsPattern('')]: Subtypes,
		[towerBomsPattern('/lineage/:lineageId/Versions')]: Versions,
		[stubBomsPattern('/lineage/:lineageId/Versions')]: Versions,
		...cuttingPlanRoutes
	},
	menu: {
		prepareRoute: async (pattern: string, params: Record<string, string>, signal?: AbortSignal) => {
			if (params.projectId) {
				await ensureProjectLabel(decodeURIComponent(params.projectId), signal);
			}
			const structureId = params.towerId ?? params.stubId;
			if (structureId) {
				await ensureStructureLabel(decodeURIComponent(structureId), signal);
			}
			if (params.lineageId) {
				await ensureLineageLabel(decodeURIComponent(params.lineageId), signal);
			}
			if (params.bomId) {
				await ensureBomLabel(decodeURIComponent(params.bomId), signal);
			}
		},
		routeTitles: browseRouteTitles,
		postProcessBreadcrumbs: (
			crumbs: Array<{ label: string; href?: string; clickable?: boolean }>,
			pattern: string,
			params: Record<string, string>
		) => {
			const projectId = params.projectId ? decodeURIComponent(params.projectId) : '';
			const towerId = params.towerId ? decodeURIComponent(params.towerId) : '';
			const stubId = params.stubId ? decodeURIComponent(params.stubId) : '';
			const lineageId = params.lineageId ? decodeURIComponent(params.lineageId) : '';
			const bomId = params.bomId ? decodeURIComponent(params.bomId) : '';
			const runId = params.runId ? decodeURIComponent(params.runId) : '';
			const enc = encodeURIComponent;
			const projectLabel = projectLabelCache.get(projectId) ?? projectId;
			const structureLabel =
				structureLabelCache.get(towerId || stubId) ?? (towerId || stubId || '');
			const structureSeg = towerId ? `Towers/${enc(towerId)}` : `Stubs/${enc(stubId)}`;
			const structureListHref = towerId
				? `Home/${enc(projectId)}/Towers`
				: `Home/${enc(projectId)}/Stubs`;
			const bomsHref = `Home/${enc(projectId)}/${structureSeg}/Boms`;
			const lineageHref = lineageId ? `${bomsHref}/lineage/${enc(lineageId)}/Versions` : bomsHref;

			const resolvedLineageId = lineageId || (bomId ? bomLineageByBomId.get(bomId) : '') || '';
			const subtypeLabel = resolvedLineageId
				? (lineageLabelCache.get(resolvedLineageId) ?? resolvedLineageId)
				: '';
			const subtypeHref = resolvedLineageId
				? `${bomsHref}/lineage/${enc(resolvedLineageId)}/Versions`
				: bomsHref;
			const versionLabel = bomId ? (bomLabelCache.get(bomId) ?? bomId) : '';
			const bomBase = bomId ? `${bomsHref}/${enc(bomId)}` : bomsHref;

			const projectHomeHref = `Home/${enc(projectId)}`;
			const kindLabel = towerId ? 'Tower Types' : 'Stubs';

			const browsePrefix = (): Array<{ label: string; href?: string; clickable?: boolean }> => [
				{ label: 'Projects', href: 'Home', clickable: true },
				{ label: projectLabel, href: projectHomeHref, clickable: true },
				{ label: 'Structures', href: projectHomeHref, clickable: true },
				{ label: kindLabel, href: structureListHref, clickable: true },
				{ label: structureLabel, href: bomsHref, clickable: true },
				{ label: 'Subtypes', href: bomsHref, clickable: true }
			];

			const withSubtypeAndVersion = (): Array<{
				label: string;
				href?: string;
				clickable?: boolean;
			}> => {
				const trail = browsePrefix();
				if (subtypeLabel) {
					trail.push({ label: subtypeLabel, href: subtypeHref, clickable: true });
				}
				if (versionLabel) {
					trail.push({ label: versionLabel, href: subtypeHref, clickable: true });
				}
				return trail;
			};

			if (pattern === 'Home/:projectId') {
				return [
					{ label: 'Projects', href: 'Home', clickable: true },
					{ label: projectLabel, href: projectHomeHref, clickable: true },
					{ label: 'Structures', href: projectHomeHref, clickable: false }
				];
			}

			if (pattern === 'Home/:projectId/Towers' || pattern === 'Home/:projectId/Stubs') {
				return [
					{ label: 'Projects', href: 'Home', clickable: true },
					{ label: projectLabel, href: projectHomeHref, clickable: true },
					{ label: 'Structures', href: projectHomeHref, clickable: true },
					{
						label: pattern.endsWith('/Towers') ? 'Tower Types' : 'Stubs',
						href: structureListHref,
						clickable: false
					}
				];
			}

			if (
				pattern.endsWith('/Boms') &&
				!pattern.includes('/:bomId') &&
				!pattern.includes('/lineage')
			) {
				return [
					{ label: 'Projects', href: 'Home', clickable: true },
					{ label: projectLabel, href: projectHomeHref, clickable: true },
					{ label: 'Structures', href: projectHomeHref, clickable: true },
					{ label: kindLabel, href: structureListHref, clickable: true },
					{ label: structureLabel, href: bomsHref, clickable: true },
					{ label: 'Subtypes', href: bomsHref, clickable: false }
				];
			}

			if (pattern.includes('/lineage/:lineageId/Versions')) {
				return [
					{ label: 'Projects', href: 'Home', clickable: true },
					{ label: projectLabel, href: projectHomeHref, clickable: true },
					{ label: 'Structures', href: projectHomeHref, clickable: true },
					{ label: kindLabel, href: structureListHref, clickable: true },
					{ label: structureLabel, href: bomsHref, clickable: true },
					{ label: 'Subtypes', href: bomsHref, clickable: true },
					{
						label: lineageLabelCache.get(lineageId) ?? lineageId,
						href: lineageHref,
						clickable: false
					}
				];
			}

			if (pattern in CP_ROUTE_TITLES) {
				const trail = withSubtypeAndVersion();
				if (pattern.endsWith('Sections')) {
					trail.push({ label: 'Select Sections', href: `${bomBase}/Sections`, clickable: false });
				} else if (pattern.endsWith('StockLengths')) {
					trail.push(
						{ label: 'Select Sections', href: `${bomBase}/Sections`, clickable: true },
						{ label: 'Stock Lengths', href: `${bomBase}/StockLengths`, clickable: false }
					);
				} else if (pattern.endsWith('/Runs')) {
					trail.push({ label: 'Plan Runs', href: `${bomBase}/Runs`, clickable: false });
				} else if (pattern.endsWith('/Summary')) {
					trail.push(
						{ label: 'Plan Runs', href: `${bomBase}/Runs`, clickable: true },
						{
							label: 'Results',
							href: `${bomBase}/Runs/${enc(runId)}/Summary`,
							clickable: false
						}
					);
				} else if (pattern.endsWith('/Plan')) {
					trail.push(
						{ label: 'Plan Runs', href: `${bomBase}/Runs`, clickable: true },
						{
							label: 'Results',
							href: `${bomBase}/Runs/${enc(runId)}/Summary`,
							clickable: true
						},
						{
							label: 'RM Required',
							href: `${bomBase}/Runs/${enc(runId)}/Plan`,
							clickable: false
						}
					);
				} else {
					trail.push({ label: CP_ROUTE_TITLES[pattern] ?? 'Cutting Plan', clickable: false });
				}
				return trail;
			}

			return crumbs;
		},
		resolveParamName: (paramName: string, paramValue: string) => {
			const value = decodeURIComponent(paramValue);
			if (paramName === 'projectId') return projectLabelCache.get(value) ?? value;
			if (paramName === 'towerId' || paramName === 'stubId') {
				return structureLabelCache.get(value) ?? value;
			}
			if (paramName === 'lineageId') return lineageLabelCache.get(value) ?? value;
			if (paramName === 'bomId') return bomLabelCache.get(value) ?? value;
			return value;
		}
	}
};
