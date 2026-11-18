import type { ToastAction, ToastOptions } from '@ifactory/ui-v2';
import type { BomStructureRef } from '../project-management-app/lib/bom-structure-routes.js';

/** Route context to open results after a background job finishes. */
export type BomResultsNav = {
	projectId: string;
	structure: BomStructureRef;
	/** Host app for CP hashes (`ProjectManagement` / `CuttingPlan` / planning shells). */
	appName?: string;
};

const CP_NAV_PREFIX = 'ifactory.cp.resultsNav.';
const OCR_NAV_PREFIX = 'ifactory.ocr.resultsNav.';

function stashNav(prefix: string, bomId: string, nav: BomResultsNav): void {
	try {
		sessionStorage.setItem(`${prefix}${bomId}`, JSON.stringify(nav));
	} catch {
		/* private mode / quota */
	}
}

function readNav(prefix: string, bomId: string): BomResultsNav | null {
	try {
		const raw = sessionStorage.getItem(`${prefix}${bomId}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as BomResultsNav;
		if (!parsed?.projectId || !parsed?.structure) return null;
		return parsed;
	} catch {
		return null;
	}
}

function clearNav(prefix: string, bomId: string): void {
	try {
		sessionStorage.removeItem(`${prefix}${bomId}`);
	} catch {
		/* ignore */
	}
}

export function stashCuttingPlanResultsNav(bomId: string, nav: BomResultsNav): void {
	stashNav(CP_NAV_PREFIX, bomId, nav);
}

export function takeCuttingPlanResultsNav(bomId: string): BomResultsNav | null {
	const nav = readNav(CP_NAV_PREFIX, bomId);
	clearNav(CP_NAV_PREFIX, bomId);
	return nav;
}

export function peekCuttingPlanResultsNav(bomId: string): BomResultsNav | null {
	return readNav(CP_NAV_PREFIX, bomId);
}

export function stashOcrResultsNav(bomId: string, nav: BomResultsNav): void {
	stashNav(OCR_NAV_PREFIX, bomId, nav);
}

export function takeOcrResultsNav(bomId: string): BomResultsNav | null {
	const nav = readNav(OCR_NAV_PREFIX, bomId);
	clearNav(OCR_NAV_PREFIX, bomId);
	return nav;
}

export function peekOcrResultsNav(bomId: string): BomResultsNav | null {
	return readNav(OCR_NAV_PREFIX, bomId);
}

type AppModule = { app: import('./os/index.svelte.js').AppDefinition };

/** `#/OCR/...` must open the OCR window — raw hash alone does not switch apps. */
async function openResultsHash(hash: string): Promise<void> {
	let decoded = hash.trim();
	try {
		decoded = decodeURIComponent(decoded);
	} catch {
		/* ignore */
	}
	if (!decoded.startsWith('#')) decoded = `#${decoded.replace(/^\/+/, '/')}`;

	const appName = decoded.match(/^#\/([^/]+)\//)?.[1];
	if (!appName) {
		window.location.hash = decoded;
		return;
	}

	const loaders: Record<string, () => Promise<AppModule>> = {
		OCR: () => import('../ocr-app/app.svelte.ts'),
		CuttingPlan: () => import('../cutting-plan-app/app.svelte.ts'),
		ProjectManagement: () => import('../project-management-app/app.svelte.ts'),
		ShopFloorPlanning: () => import('../shop-floor-planning-app/app.svelte.ts'),
		RMI: () => import('../rm-indent-app/app.svelte.ts'),
		CentralPlanning: () => import('../central-planning-app/app.svelte.ts')
	};

	const load = loaders[appName];
	if (!load) {
		window.location.hash = decoded;
		return;
	}

	const [{ openAppAtHash }, { app }] = await Promise.all([import('./os/index.svelte.js'), load()]);
	openAppAtHash(app, decoded);
}

/** Toast action that opens the owning app at the results hash (toast API has no href). */
export function viewResultsToastAction(hash: string, label = 'View results'): ToastAction {
	return {
		label,
		variant: 'primary',
		class: 'bg-primary hover:bg-primary/90',
		onclick: () => {
			void openResultsHash(hash);
		}
	};
}

export function withViewResultsAction(
	options: ToastOptions,
	hash: string | null | undefined
): ToastOptions {
	if (!hash?.trim()) return options;
	return {
		...options,
		// Stay until View results or dismiss — user may be in another app.
		duration: undefined,
		showCloseButton: options.showCloseButton ?? true,
		actions: [viewResultsToastAction(hash.trim()), ...(options.actions ?? [])],
		actionPlacement: options.actionPlacement ?? 'below'
	};
}
