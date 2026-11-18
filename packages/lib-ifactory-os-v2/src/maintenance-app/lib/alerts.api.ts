// Mock-backed alert taxonomy CRUD. Integration note: v1 source is
// cms/items/ifactory_alerts_master.
import { mockAlerts } from './alerts.mock.js';
import { clone, mockDelay, nextMockId } from './mock-utils.js';
import type { AlertMaster } from './types.js';

const alertsStore: AlertMaster[] = clone(mockAlerts);

/** Full taxonomy: top-level alerts, sub-categories and reasons. */
export async function listAlerts(signal?: AbortSignal): Promise<AlertMaster[]> {
	await mockDelay(signal);
	return clone(alertsStore);
}

export async function getAlert(id: number, signal?: AbortSignal): Promise<AlertMaster | null> {
	await mockDelay(signal);
	const alert = alertsStore.find((row) => row.id === id);
	return alert ? clone(alert) : null;
}

export type SaveAlertInput = {
	name: string;
	description: string;
};

export async function createAlert(
	input: SaveAlertInput,
	signal?: AbortSignal
): Promise<AlertMaster> {
	await mockDelay(signal);
	const duplicate = alertsStore.some(
		(row) => !row.parent_id && row.name.toLowerCase() === input.name.toLowerCase()
	);
	if (duplicate) {
		throw new Error('An alert with this name already exists.');
	}
	const alert: AlertMaster = {
		id: nextMockId(),
		name: input.name,
		description: input.description || null,
		parent_id: null,
		is_alert_sub_category: false,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: false
	};
	alertsStore.push(alert);
	return clone(alert);
}

export async function updateAlert(
	id: number,
	input: SaveAlertInput,
	signal?: AbortSignal
): Promise<void> {
	await mockDelay(signal);
	const alert = alertsStore.find((row) => row.id === id);
	if (!alert) throw new Error('Alert not found.');
	alert.name = input.name;
	alert.description = input.description || null;
}

export async function deleteAlert(id: number, signal?: AbortSignal): Promise<void> {
	await mockDelay(signal);
	const index = alertsStore.findIndex((row) => row.id === id);
	if (index >= 0) alertsStore.splice(index, 1);
}

// --- Taxonomy helpers shared by ticket screens ---

export function topLevelAlerts(alerts: AlertMaster[]): AlertMaster[] {
	return alerts.filter((alert) => !alert.parent_id && alert.alert_group_id === 1);
}

export function subCategoriesOf(alerts: AlertMaster[], alertId: number | null): AlertMaster[] {
	if (alertId == null) return [];
	return alerts.filter((alert) => alert.is_alert_sub_category && alert.parent_id === alertId);
}

export function reasonsOf(alerts: AlertMaster[], alertId: number | null): AlertMaster[] {
	const subCategoryIds = new Set(subCategoriesOf(alerts, alertId).map((sub) => sub.id));
	return alerts.filter(
		(alert) =>
			alert.is_alert_reason && alert.parent_id != null && subCategoryIds.has(alert.parent_id)
	);
}

export function alertNameById(alerts: AlertMaster[]): Map<number, string> {
	return new Map(alerts.map((alert) => [alert.id, alert.name]));
}

/**
 * For a ticket's sub_alert_id (usually a reason), resolve the reason and
 * its parent sub-category names.
 */
export function resolveTicketTaxonomy(
	alerts: AlertMaster[],
	subAlertId: number | null
): { subCategory: AlertMaster | null; reason: AlertMaster | null } {
	if (subAlertId == null) return { subCategory: null, reason: null };
	const subAlert = alerts.find((alert) => alert.id === subAlertId) ?? null;
	if (!subAlert) return { subCategory: null, reason: null };
	if (subAlert.is_alert_reason) {
		const subCategory = alerts.find((alert) => alert.id === subAlert.parent_id) ?? null;
		return { subCategory, reason: subAlert };
	}
	if (subAlert.is_alert_sub_category) {
		return { subCategory: subAlert, reason: null };
	}
	return { subCategory: null, reason: null };
}
