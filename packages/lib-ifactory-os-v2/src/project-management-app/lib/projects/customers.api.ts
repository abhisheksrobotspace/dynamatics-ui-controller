import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import type { Customer, ProjCustomerRow } from './types.js';

function mapCustomerRow(row: ProjCustomerRow): Customer {
	return {
		id: row.customer_id,
		name: row.name
	};
}

const LIST_CUSTOMERS_URL = 'proj_customers?active=true&orderBy=name:asc&select=customer_id,name';

/** Active customers — `customer_id` and `name` only. */
export async function listCustomers(signal?: AbortSignal): Promise<Customer[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjCustomerRow[]>>(
		apiClient.datahub(LIST_CUSTOMERS_URL),
		{ signal }
	);
	return rowsFromEnvelope<ProjCustomerRow>(envelope.data).map(mapCustomerRow);
}

/** One customer by id — avoids listing every customer for a feature page. */
export async function getCustomerById(
	customerId: string,
	signal?: AbortSignal
): Promise<Customer | null> {
	const envelope = await apiClient.get<ApiEnvelope<ProjCustomerRow[]>>(
		apiClient.datahub(
			`proj_customers?customer_id=${encodeURIComponent(customerId)}&select=customer_id,name`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjCustomerRow>(envelope.data)[0];
	return row ? mapCustomerRow(row) : null;
}

export async function createCustomer(name: string, signal?: AbortSignal): Promise<Customer> {
	const envelope = await apiClient.post<ApiEnvelope<ProjCustomerRow>>(
		apiClient.datahub('proj_customers'),
		{ name: name.trim() },
		{ signal }
	);

	const row = rowsFromEnvelope<ProjCustomerRow>(envelope.data)[0];
	if (!row) throw new Error('Create customer returned no data');

	return mapCustomerRow(row);
}

export async function updateCustomer(
	customerId: string,
	name: string,
	signal?: AbortSignal
): Promise<Customer> {
	const envelope = await apiClient.patch<ApiEnvelope<ProjCustomerRow>>(
		apiClient.datahub(`proj_customers/${customerId}`),
		{ name: name.trim() },
		{ signal }
	);

	const row = rowsFromEnvelope<ProjCustomerRow>(envelope.data)[0];
	if (!row) throw new Error('Update customer returned no data');

	return mapCustomerRow(row);
}

export async function deleteCustomer(customerId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_customers/${customerId}`), { signal });
}
