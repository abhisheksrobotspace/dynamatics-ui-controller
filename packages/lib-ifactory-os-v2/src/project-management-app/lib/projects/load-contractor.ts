import { getContractorById } from './contractors.api.js';
import type { Contractor } from './types.js';

const contractorBreadcrumbs = new Map<string, { id: string; name: string }>();

export function upsertContractorBreadcrumb(contractor: Pick<Contractor, 'id' | 'name'>): void {
	contractorBreadcrumbs.set(contractor.id, { id: contractor.id, name: contractor.name });
}

export function getContractorBreadcrumb(contractorId: string): { id: string; name: string } | null {
	return contractorBreadcrumbs.get(contractorId) ?? null;
}

/** Loads contractor label for shell breadcrumbs / deep-links. */
export async function ensureContractorBreadcrumb(
	contractorId: string,
	signal?: AbortSignal
): Promise<{ id: string; name: string } | null> {
	const cached = contractorBreadcrumbs.get(contractorId);
	if (cached) return cached;

	const contractor = await getContractorById(contractorId, signal);
	if (!contractor) return null;

	upsertContractorBreadcrumb(contractor);
	return { id: contractor.id, name: contractor.name };
}
