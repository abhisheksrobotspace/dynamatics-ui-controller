import type { Component } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { AlertTriangle } from '@lucide/svelte';
import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { STOPPAGE_REASONS, isSelectableReason, type StoppageReason } from '$lib/stoppage-reasons';
import {
	ensureSelectedAssetId,
	getSelectedAssetId,
	setSelectedAssetId
} from '$lib/os/asset-context.js';

type SettingsReason = {
	alertCode: string;
	alertName: string;
	buttonNo: number | null;
	defaultMachineState?: number;
	requiresAck?: boolean;
	autoTicket?: boolean;
	isBreakdown?: boolean;
	oeeCategory?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const next = value.trim();
	return next || null;
}

function parseSettingsReason(raw: unknown): SettingsReason | null {
	if (!isRecord(raw)) return null;
	const alertCode = asString(raw.alertCode)?.toLowerCase();
	const alertName = asString(raw.alertName);
	if (!alertCode || !alertName) return null;
	const buttonNo =
		typeof raw.buttonNo === 'number' && Number.isFinite(raw.buttonNo) ? raw.buttonNo : null;
	return {
		alertCode,
		alertName,
		buttonNo,
		defaultMachineState:
			typeof raw.defaultMachineState === 'number' ? raw.defaultMachineState : undefined,
		requiresAck: typeof raw.requiresAck === 'boolean' ? raw.requiresAck : undefined,
		autoTicket: typeof raw.autoTicket === 'boolean' ? raw.autoTicket : undefined,
		isBreakdown: typeof raw.isBreakdown === 'boolean' ? raw.isBreakdown : undefined,
		oeeCategory: asString(raw.oeeCategory) ?? undefined
	};
}

function iconFor(alertCode: string): Component<{ class?: string }> {
	return STOPPAGE_REASONS.find((entry) => entry.alertCode === alertCode)?.icon ?? AlertTriangle;
}

/** Stable numeric id for ReasonCard when `buttonNo` is null. */
function fallbackId(alertCode: string): number {
	let hash = 0;
	for (let i = 0; i < alertCode.length; i += 1) {
		hash = (hash * 31 + alertCode.charCodeAt(i)) | 0;
	}
	return 1000 + (Math.abs(hash) % 9000);
}

function toStoppageReason(reason: SettingsReason): StoppageReason {
	const fromLegacy = STOPPAGE_REASONS.find((entry) => entry.alertCode === reason.alertCode);
	return {
		id: reason.buttonNo ?? fromLegacy?.id ?? fallbackId(reason.alertCode),
		alertCode: reason.alertCode,
		label: reason.alertName,
		icon: iconFor(reason.alertCode),
		buttonNo: reason.buttonNo,
		requiresAck: reason.requiresAck,
		defaultMachineState: reason.defaultMachineState
	};
}

/**
 * Doc §1 / controller: `_shared.reasons ++ _shared.reasonsByClass[assetClass]` (ADD).
 * Accepts legacy `reasonsByType[assetType]` as a fallback for older settings pushes.
 */
export function effectiveReasonsFromSettings(
	settings: Record<string, unknown>,
	assetId: string | null
): StoppageReason[] {
	const shared = isRecord(settings._shared) ? settings._shared : {};
	const machines = Object.entries(settings).filter(
		(entry): entry is [string, Record<string, unknown>] =>
			entry[0] !== '_shared' && isRecord(entry[1])
	);

	let machine: Record<string, unknown> | null = null;
	if (assetId) {
		machine =
			machines.find(
				([key, m]) =>
					key === assetId || asString(m.assetId) === assetId || asString(m.aid) === assetId
			)?.[1] ?? null;
	}
	if (!machine && machines.length > 0) {
		machine = machines[0][1];
	}

	const assetClass = asString(machine?.assetClass) ?? '';
	const assetType = asString(machine?.assetType) ?? '';
	const base = Array.isArray(shared.reasons) ? shared.reasons : [];
	const byClass =
		isRecord(shared.reasonsByClass) &&
		assetClass &&
		Array.isArray(shared.reasonsByClass[assetClass])
			? (shared.reasonsByClass[assetClass] as unknown[])
			: [];
	const byTypeLegacy =
		byClass.length === 0 &&
		isRecord(shared.reasonsByType) &&
		assetType &&
		Array.isArray(shared.reasonsByType[assetType])
			? (shared.reasonsByType[assetType] as unknown[])
			: [];

	const seen = new SvelteSet<string>();
	const out: StoppageReason[] = [];
	for (const raw of [...base, ...byClass, ...byTypeLegacy]) {
		const parsed = parseSettingsReason(raw);
		if (!parsed || seen.has(parsed.alertCode)) continue;
		seen.add(parsed.alertCode);
		out.push(toStoppageReason(parsed));
	}
	return out;
}

/** Reactive catalog — buttons render this, never a hard-coded list when settings load. */
export const reasonsCatalog = $state({
	reasons: [...STOPPAGE_REASONS] as StoppageReason[],
	/** True when reasons came from machineSettings (not static fallback). */
	loaded: false,
	/** True after the first hydrate attempt settles (success, empty, or failure). */
	ready: false
});

function markCatalogReady(reasons: StoppageReason[], fromSettings: boolean) {
	reasonsCatalog.reasons = reasons;
	reasonsCatalog.loaded = fromSettings;
	reasonsCatalog.ready = true;
}

export function getCatalogReasons(): StoppageReason[] {
	return reasonsCatalog.reasons;
}

export function findCatalogReasonByCode(alertCode: string): StoppageReason | undefined {
	const code = alertCode.trim().toLowerCase();
	if (!code) return undefined;
	return reasonsCatalog.reasons.find((entry) => entry.alertCode === code);
}

export function findCatalogReasonById(id: number): StoppageReason | undefined {
	return reasonsCatalog.reasons.find((entry) => entry.id === id);
}

/** Operator-facing buttons only — system codes stay in `reasons` for auto-alert lookup. */
export function getSelectableCatalogReasons(): StoppageReason[] {
	return reasonsCatalog.reasons.filter(isSelectableReason);
}

export async function loadReasonsCatalog(): Promise<StoppageReason[]> {
	await ensureSelectedAssetId();
	try {
		const settings = await globalMqtt.get('machineSettings');
		if (!isRecord(settings) || 'error' in settings) {
			console.error('reasons-catalog: machineSettings unavailable', settings);
			markCatalogReady([...STOPPAGE_REASONS], false);
			return reasonsCatalog.reasons;
		}

		// Prefer aid from first machine if selection still empty
		if (!getSelectedAssetId()) {
			const machines = Object.entries(settings).filter(
				(entry): entry is [string, Record<string, unknown>] =>
					entry[0] !== '_shared' && isRecord(entry[1])
			);
			if (machines.length > 0) {
				const [key, machine] = machines[0];
				setSelectedAssetId(asString(machine.aid) ?? asString(machine.assetId) ?? key);
			}
		}

		const effective = effectiveReasonsFromSettings(settings, getSelectedAssetId());
		markCatalogReady(
			effective.length > 0 ? effective : [...STOPPAGE_REASONS],
			effective.length > 0
		);
		return reasonsCatalog.reasons;
	} catch (error) {
		console.error('reasons-catalog: failed to load machineSettings', error);
		markCatalogReady([...STOPPAGE_REASONS], false);
		return reasonsCatalog.reasons;
	}
}

/** Apply static fallback and mark ready (boot timeout / MQTT never connected). */
export function applyStaticReasonsFallback(reason = 'fallback'): StoppageReason[] {
	console.warn(`reasons-catalog: ${reason}; using static STOPPAGE_REASONS`);
	markCatalogReady([...STOPPAGE_REASONS], false);
	return reasonsCatalog.reasons;
}
