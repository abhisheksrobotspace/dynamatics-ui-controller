import { SvelteMap } from 'svelte/reactivity';
import Home from './routes/Home.svelte';
import ProjectHome from './routes/ProjectHome.svelte';
import Towers from './routes/Towers.svelte';
import Stubs from './routes/Stubs.svelte';
import Subtypes from './routes/Subtypes.svelte';
import Versions from './routes/Versions.svelte';
import BomDetail from './routes/BomDetail.svelte';
import BomItems from './routes/BomItems.svelte';
import DrawingSetDetail from './routes/DrawingSetDetail.svelte';
import MarkRegion from './routes/MarkRegion.svelte';
import Results from './routes/Results.svelte';
import AppSidebar from './components/AppSidebar.svelte';
import TopbarControls from './components/TopbarControls.svelte';
import { apiClient } from '../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../lib/api/types.js';
import { ocrProjectDisplayLabel } from './lib/ocr-drawings.api.js';
import { readOcrGenerateSessionForBom } from './lib/ocr-generate-session.js';

const projectLabelCache = new SvelteMap<string, string>();
const structureLabelCache = new SvelteMap<string, string>();
const lineageLabelCache = new SvelteMap<string, string>();
/** Breadcrumb label for a BOM version — `v{n}` only (no subtype or stage). */
const bomLabelCache = new SvelteMap<string, string>();
/** `bom_id` → `bom_lineage_id` so Detail/Items/etc. can keep the subtype crumb. */
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
		const row = rowsFromEnvelope(envelope.data)[0];
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
		const row = rowsFromEnvelope(envelope.data)[0];
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
		const row = rowsFromEnvelope(envelope.data)[0];
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
		const row = rowsFromEnvelope(envelope.data)[0];
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

const browseRouteTitles: Record<string, string> = {
	Home: 'Projects',
	'Home/:projectId/Towers': 'Tower Types',
	'Home/:projectId/Stubs': 'Stubs',
	// Project home / Subtypes / Versions / Drawing Sets: last crumb is set in postProcess —
	// do not set routeTitles here or AppShell overwrites/duplicates that label.
	[towerBomsPattern('/:bomId/MarkRegion')]: 'Mark Region',
	[stubBomsPattern('/:bomId/MarkRegion')]: 'Mark Region',
	[towerBomsPattern('/:bomId/Items')]: 'BOM Items',
	[stubBomsPattern('/:bomId/Items')]: 'BOM Items',
	[towerBomsPattern('/:bomId/Results')]: 'Operations Count Results',
	[stubBomsPattern('/:bomId/Results')]: 'Operations Count Results'
};

export const app = {
	appName: 'OCR',
	appCode: 'OCR',
	displayName: 'OCR',
	dockColor: '#66B3F2',
	icon: '/assets/icons/project-setup.svg',
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
		[towerBomsPattern('/:bomId/Detail')]: BomDetail,
		[stubBomsPattern('/:bomId/Detail')]: BomDetail,
		[towerBomsPattern('/:bomId/Items')]: BomItems,
		[stubBomsPattern('/:bomId/Items')]: BomItems,
		[towerBomsPattern('/:bomId/DrawingSets/:drawingSetName')]: DrawingSetDetail,
		[stubBomsPattern('/:bomId/DrawingSets/:drawingSetName')]: DrawingSetDetail,
		[towerBomsPattern('/:bomId/MarkRegion')]: MarkRegion,
		[stubBomsPattern('/:bomId/MarkRegion')]: MarkRegion,
		[towerBomsPattern('/:bomId/Results')]: Results,
		[stubBomsPattern('/:bomId/Results')]: Results
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
			const drawingSetName = params.drawingSetName ? decodeURIComponent(params.drawingSetName) : '';
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
			const detailHref = bomId ? `${bomsHref}/${enc(bomId)}/Detail` : bomsHref;
			const drawingSetHref =
				bomId && drawingSetName
					? `${bomsHref}/${enc(bomId)}/DrawingSets/${enc(drawingSetName)}`
					: detailHref;

			const resolvedLineageId = lineageId || (bomId ? bomLineageByBomId.get(bomId) : '') || '';
			const subtypeLabel = resolvedLineageId
				? (lineageLabelCache.get(resolvedLineageId) ?? resolvedLineageId)
				: '';
			const subtypeHref = resolvedLineageId
				? `${bomsHref}/lineage/${enc(resolvedLineageId)}/Versions`
				: bomsHref;
			const versionLabel = bomId ? (bomLabelCache.get(bomId) ?? bomId) : '';

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

			const withSubtype = (): Array<{ label: string; href?: string; clickable?: boolean }> => {
				const trail = browsePrefix();
				if (subtypeLabel) {
					trail.push({ label: subtypeLabel, href: subtypeHref, clickable: true });
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

			if (pattern.endsWith('/Detail')) {
				return [
					...withSubtype(),
					{
						label: versionLabel,
						href: detailHref,
						clickable: false
					}
				];
			}

			if (pattern.endsWith('/Items')) {
				return [
					...withSubtype(),
					{
						label: versionLabel,
						href: detailHref,
						clickable: true
					},
					{ label: 'BOM Items', href: `${bomsHref}/${enc(bomId)}/Items`, clickable: false }
				];
			}

			if (pattern.includes('/DrawingSets/')) {
				return [
					...withSubtype(),
					{
						label: versionLabel,
						href: detailHref,
						clickable: true
					},
					{ label: drawingSetName, href: drawingSetHref, clickable: false }
				];
			}

			if (pattern.endsWith('/MarkRegion') || pattern.endsWith('/Results')) {
				const pageLabel = pattern.endsWith('/MarkRegion')
					? 'Mark Region'
					: 'Operations Count Results';
				const sessionDrawingSet = bomId
					? readOcrGenerateSessionForBom(bomId)?.drawingSet?.trim()
					: undefined;
				const setName = sessionDrawingSet || drawingSetName;
				const setHref =
					bomId && setName ? `${bomsHref}/${enc(bomId)}/DrawingSets/${enc(setName)}` : detailHref;

				const trail = [
					...withSubtype(),
					{
						label: versionLabel,
						href: detailHref,
						clickable: true
					}
				];
				if (setName) {
					trail.push({ label: setName, href: setHref, clickable: true });
				}
				trail.push({ label: pageLabel, clickable: false });
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
			if (paramName === 'drawingSetName') return value;
			return value;
		}
	}
};
