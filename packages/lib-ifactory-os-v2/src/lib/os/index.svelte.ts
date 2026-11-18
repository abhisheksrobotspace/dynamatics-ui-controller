// V1 logic ported to TypeScript — only type annotations added, zero logic changes.
import { BROWSER } from 'esm-env';
import {
	deleteCachedData,
	getCachedData,
	setCachedData
} from '$lib/customScripts/cache-manager.js';
import {
	createDefaultAppDateFilter,
	migrateLegacySharedDateFilter,
	type AppDateFilter
} from '$lib/appShell/appSharedState.js';
import { STORAGE_TYPES } from '$lib/customScripts/constants.js';
import type { Component } from 'svelte';
import { isAppVisible } from './app-visibility.svelte.js';

// ── TypeScript-only type additions (no equivalent in V1 JS) ──────────────────
export interface UserProfile {
	id?: string;
	name?: string;
	email?: string;
	avatar?: string;
	isLoggedIn?: boolean;
	activeFactory?: string | number | null;
	activeFactoryName?: string;
	factories?: unknown[];
	capabilities?: { modules?: { code: string; visible?: boolean }[] };
	[key: string]: unknown;
}

export interface AppWindowControls {
	close?: boolean;
	minimize?: boolean;
	draggable?: boolean;
	/** App title/breadcrumb bar. Default true; HMI apps under the OS top bar set false. */
	menuBar?: boolean;
}

export interface AppDefinition {
	appName: string;
	displayName?: string;
	code?: string;
	appCode?: string | null;
	icon?: string;
	dockColor?: string;
	showInLauncher?: boolean;
	autoLaunchOnLogin?: boolean;
	/**
	 * Dock + auto-launch availability. Default `always`.
	 * `requiresAssetClass`: hidden on ioware until machineSettings has an assetClass.
	 * With `supportedAssetClasses`, also hidden when the class is not in that list.
	 */
	visibility?: 'always' | 'requiresAssetClass';
	/** When set, `requiresAssetClass` apps show only for these machineSettings classes. */
	supportedAssetClasses?: readonly string[];
	windowControls?: AppWindowControls;
	data?: unknown;
	menu?: unknown;
	routes?: Record<string, Component<Record<string, unknown>>>;
	strings?: Record<string, string>;
	sidebar?: Component<Record<string, unknown>>;
	topbarComponent?: Component<Record<string, unknown>>;
	sharedDateFilter?: AppDateFilter | null;
	minimised?: boolean;
	currentRoute?: string;
	[key: string]: unknown;
}
// ─────────────────────────────────────────────────────────────────────────────

export const osMenu = $state({ open: false });

export const appsRunning = $state<Record<string, AppDefinition>>({});

export const appStackOrder = $state<Record<string, number>>({});

export const user = $state<UserProfile>({});

/** Edge / IoWare: operator switch flow on lockscreen. Unused by cloud. */
export const switchOperator = $state({ isClicked: false });

export const currentActiveAppId = $state<{ appId: string | null }>({ appId: null });

export function canCloseApp(app: AppDefinition): boolean {
	return app.windowControls?.close !== false;
}

export function canMinimizeApp(app: AppDefinition): boolean {
	return app.windowControls?.minimize !== false;
}

const OS_RUNTIME_STATE_KEY = 'ifactory-os-runtime-state';

interface OSRuntimeAppSnapshot {
	appInstanceId: string;
	appName: string;
	appCode?: string | null;
	minimised?: boolean;
	currentRoute?: string;
	sharedDateFilter?: Partial<AppDateFilter>;
}

interface OSRuntimeStateSnapshot {
	appCount?: number;
	zIndexCounter?: number;
	currentActiveAppId?: string | null;
	appsRunning?: OSRuntimeAppSnapshot[];
	appStackOrder?: Record<string, number>;
}

//TODO: replace simple count with uuid
let appCount = 0;
let zIndexCounter = 0;
let isRestoringState = false;

function canUseStorage() {
	return BROWSER && typeof window !== 'undefined';
}

function getAppDefinitionByName(apps: Record<string, AppDefinition>, appName: string) {
	return Object.values(apps).find((app) => app.appName === appName) ?? null;
}

function getDefaultFactoryId() {
	return user.activeFactory ?? null;
}

function normalizeSharedDateFilter(
	sharedDateFilter: Partial<AppDateFilter> | null | undefined
): AppDateFilter {
	const normalizedFilter = {
		...createDefaultAppDateFilter(getDefaultFactoryId()),
		...(sharedDateFilter ?? {})
	};

	if (
		normalizedFilter.selectedFactoryId === undefined ||
		normalizedFilter.selectedFactoryId === null
	) {
		normalizedFilter.selectedFactoryId = getDefaultFactoryId();
	}

	migrateLegacySharedDateFilter(normalizedFilter);

	return normalizedFilter;
}

function resolveActiveFactoryIdFromApps(
	appEntries: { appInstanceId: string; app: AppDefinition }[],
	preferredAppId: string | null = null
) {
	const normalizedEntries = appEntries;

	if (normalizedEntries.length === 0) {
		return undefined;
	}

	const preferredEntry = preferredAppId
		? normalizedEntries.find((entry) => entry.appInstanceId === preferredAppId)
		: null;

	const preferredFactoryId = preferredEntry?.app?.sharedDateFilter?.selectedFactoryId;
	if (preferredFactoryId !== undefined && preferredFactoryId !== null) {
		return preferredFactoryId;
	}

	const fallbackEntry = normalizedEntries.find((entry) => {
		const factoryId = entry.app?.sharedDateFilter?.selectedFactoryId;
		return factoryId !== undefined && factoryId !== null;
	});

	return fallbackEntry?.app?.sharedDateFilter?.selectedFactoryId;
}

export async function persistOSState() {
	if (isRestoringState || !canUseStorage()) {
		return;
	}

	const runningAppsSnapshot = Object.entries(appsRunning).map(([appInstanceId, app]) => ({
		appInstanceId,
		appName: app.appName,
		appCode: app.appCode ?? null,
		minimised: Boolean(app.minimised),
		currentRoute: app.currentRoute ?? 'Home',
		sharedDateFilter: normalizeSharedDateFilter(app.sharedDateFilter)
	}));

	const snapshot = {
		appCount,
		zIndexCounter,
		currentActiveAppId: currentActiveAppId.appId ?? null,
		appsRunning: runningAppsSnapshot,
		appStackOrder: { ...appStackOrder }
	};

	const nextActiveFactoryId = resolveActiveFactoryIdFromApps(
		runningAppsSnapshot.map((app) => ({
			appInstanceId: app.appInstanceId,
			app: app as unknown as AppDefinition
		})),
		currentActiveAppId.appId ?? null
	);

	if (nextActiveFactoryId !== undefined) {
		user.activeFactory = nextActiveFactoryId;
	}

	await setCachedData(OS_RUNTIME_STATE_KEY, snapshot, STORAGE_TYPES.SESSION_STORAGE);
}

export async function restoreOSState(apps: Record<string, AppDefinition>) {
	if (!canUseStorage()) {
		return;
	}

	const snapshot = (await getCachedData(
		'',
		STORAGE_TYPES.SESSION_STORAGE,
		OS_RUNTIME_STATE_KEY
	)) as OSRuntimeStateSnapshot | null;
	if (!snapshot) {
		return;
	}

	try {
		isRestoringState = true;

		Object.keys(appsRunning).forEach((appInstanceId) => {
			delete appsRunning[appInstanceId];
		});
		Object.keys(appStackOrder).forEach((appInstanceId) => {
			delete appStackOrder[appInstanceId];
		});

		for (const appSnapshot of snapshot.appsRunning ?? []) {
			const appDefinition = getAppDefinitionByName(apps, appSnapshot.appName);
			if (!appDefinition) {
				continue;
			}

			appsRunning[appSnapshot.appInstanceId] = {
				...appDefinition,
				appName: appDefinition.appName,
				appCode: appDefinition.code ?? appSnapshot.appCode ?? null,
				icon: appDefinition.icon,
				minimised: Boolean(appSnapshot.minimised),
				currentRoute: appSnapshot.currentRoute ?? 'Home',
				sharedDateFilter: normalizeSharedDateFilter(null)
			};
		}

		Object.entries(snapshot.appStackOrder ?? {}).forEach(([appInstanceId, zIndex]) => {
			if (appsRunning[appInstanceId]) {
				appStackOrder[appInstanceId] = zIndex as number;
			}
		});
		appCount = snapshot.appCount ?? Object.keys(appsRunning).length;
		zIndexCounter = snapshot.zIndexCounter ?? Math.max(0, ...Object.values(appStackOrder));

		const restoredActiveAppId = snapshot.currentActiveAppId;
		currentActiveAppId.appId =
			restoredActiveAppId && appsRunning[restoredActiveAppId] ? restoredActiveAppId : null;

		const restoredActiveFactoryId = resolveActiveFactoryIdFromApps(
			Object.entries(appsRunning).map(([appInstanceId, app]) => ({ appInstanceId, app })),
			currentActiveAppId.appId ?? null
		);

		if (restoredActiveFactoryId !== undefined) {
			user.activeFactory = restoredActiveFactoryId;
		}
	} catch (error) {
		console.error('Failed to restore OS runtime state:', error);
		await deleteCachedData(OS_RUNTIME_STATE_KEY, STORAGE_TYPES.SESSION_STORAGE);
	} finally {
		isRestoringState = false;
		// NOTE: intentionally NOT calling persistOSState() here.
		// In Svelte 5, $state proxy writes are batched — appsRunning reads as empty
		// in the finally block even though entries were set in try. Calling persistOSState()
		// here would overwrite restored state with []. V1 worked because Svelte 4 was synchronous.
	}
}

export async function clearOSState() {
	if (!canUseStorage()) {
		return;
	}
	await deleteCachedData(OS_RUNTIME_STATE_KEY, STORAGE_TYPES.SESSION_STORAGE);
}

function findOpenAppInstanceId(appName: string): string | null {
	const matchingAppIds = Object.entries(appsRunning)
		.filter(([, runningApp]) => runningApp.appName === appName)
		.map(([appId]) => appId);

	if (matchingAppIds.length === 0) {
		return null;
	}

	return matchingAppIds.reduce((topAppId, candidateAppId) => {
		const topZIndex = appStackOrder[topAppId] ?? -1;
		const candidateZIndex = appStackOrder[candidateAppId] ?? -1;
		return candidateZIndex > topZIndex ? candidateAppId : topAppId;
	});
}

/** Launch (or focus) an app and navigate it to a hash owned by that app. */
export function openAppAtHash(app: AppDefinition, hash: string) {
	const prefix = `#/${app.appName}/`;
	let decodedHash = hash;
	try {
		decodedHash = decodeURIComponent(hash);
	} catch {
		/* ignore */
	}

	if (!decodedHash.startsWith(prefix)) {
		throw new Error(`Hash "${hash}" is not for app "${app.appName}"`);
	}

	const routePath = decodedHash.slice(prefix.length) || 'Home';

	// Stamp the destination before focus() so dock hash-sync targets this route.
	const existingAppId = findOpenAppInstanceId(app.appName);
	if (existingAppId) {
		appsRunning[existingAppId].currentRoute = routePath;
	}

	launchApp(app);

	const appId = currentActiveAppId.appId;
	if (appId && appsRunning[appId]?.appName === app.appName) {
		appsRunning[appId].currentRoute = routePath;
	}

	let currentDecoded = window.location.hash || '';
	try {
		currentDecoded = decodeURIComponent(currentDecoded);
	} catch {
		/* ignore */
	}

	if (currentDecoded === decodedHash) {
		// Same URL as before (common after switching apps without syncing hash) — force listeners.
		window.dispatchEvent(new HashChangeEvent('hashchange'));
	} else {
		window.location.hash = decodedHash;
	}
}

function hashForRunningApp(appId: string): string | null {
	const running = appsRunning[appId];
	if (!running?.appName) return null;
	const route = (running.currentRoute || 'Home').replace(/^\/+/, '');
	return `#/${running.appName}/${route}`;
}

export function launchApp(app: AppDefinition, newInstance?: string) {
	const existingAppId = findOpenAppInstanceId(app.appName);

	if (!existingAppId) {
		const newAppInstanceId = app.appName + appCount;
		appsRunning[newAppInstanceId] = {
			...app,
			appCode: app.code ?? app.appCode ?? null,
			minimised: false,
			currentRoute: 'Home',
			sharedDateFilter: normalizeSharedDateFilter(app.sharedDateFilter)
		};
		appCount++;
		focus(newAppInstanceId);
	} else if (newInstance == 'new') {
		const newAppInstanceId = app.appName + appCount;
		appsRunning[newAppInstanceId] = {
			...app,
			appCode: app.code ?? app.appCode ?? null,
			minimised: false,
			currentRoute: 'Home',
			sharedDateFilter: normalizeSharedDateFilter(app.sharedDateFilter)
		};
		appCount++;
		focus(newAppInstanceId);
	} else {
		appsRunning[existingAppId].minimised = false;
		focus(existingAppId);
	}
	osMenu.open = false;
	persistOSState();
}

export function launchAutoStartApps(
	apps: Record<string, AppDefinition>,
	options?: { isIoware?: boolean }
) {
	const isIoware = options?.isIoware ?? false;
	for (const app of Object.values(apps)) {
		if (!app.autoLaunchOnLogin) continue;
		if (!isAppVisible(app, isIoware)) continue;
		launchApp(app);
	}
}

export function removeApp(appId: string): boolean {
	const app = appsRunning[appId];
	if (app && !canCloseApp(app)) {
		return false;
	}

	delete appsRunning[appId];
	delete appStackOrder[appId];

	if (currentActiveAppId.appId === appId) {
		currentActiveAppId.appId = null;
	}

	persistOSState();
	return true;
}

export function minimiseApp(appId: string): boolean {
	const app = appsRunning[appId];
	if (!app || !canMinimizeApp(app)) {
		return false;
	}

	app.minimised = true;
	if (currentActiveAppId.appId === appId) {
		currentActiveAppId.appId = null;
	}
	persistOSState();
	return true;
}

//TODO: normalise the z-index
export function focus(appId: string) {
	currentActiveAppId.appId = appId;
	osMenu.open = false;
	if (appStackOrder[appId] != zIndexCounter) {
		zIndexCounter++;
		appStackOrder[appId] = zIndexCounter;
	}

	// Keep the URL hash aligned with the focused window so later cross-app
	// navigations (openAppAtHash) always produce a real hashchange.
	const nextHash = hashForRunningApp(appId);
	if (nextHash) {
		let currentDecoded = window.location.hash || '';
		try {
			currentDecoded = decodeURIComponent(currentDecoded);
		} catch {
			/* ignore */
		}
		let nextDecoded = nextHash;
		try {
			nextDecoded = decodeURIComponent(nextHash);
		} catch {
			/* ignore */
		}
		if (currentDecoded !== nextDecoded) {
			window.location.hash = nextHash;
		}
	}

	persistOSState();
}

/**
 * Bring a running app in front of whatever the operator has open, minimising that app.
 * Does nothing when the app is already in front. Returns whether anything changed.
 */
export function bringAppToFront(appName: string): boolean {
	const appId = findOpenAppInstanceId(appName);
	if (!appId) return false;
	const activeId = currentActiveAppId.appId;
	if (activeId === appId && !appsRunning[appId].minimised) return false;
	if (activeId && activeId !== appId) minimiseApp(activeId);
	appsRunning[appId].minimised = false;
	focus(appId);
	return true;
}

export function minimizeAllApps() {
	Object.keys(appsRunning).forEach((appId) => {
		appsRunning[appId].minimised = true;
	});
	currentActiveAppId.appId = null;
	persistOSState();
}
