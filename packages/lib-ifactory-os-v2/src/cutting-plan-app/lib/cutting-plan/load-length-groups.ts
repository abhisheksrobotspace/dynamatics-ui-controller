import type { LengthGroup } from '../../../project-management-app/lib/store.svelte.js';
import { listLengthGroups } from './cp.api.js';

const loadInFlight = new Map<string, Promise<LengthGroup[]>>();

/** Loads length groups for a project page (dedupes concurrent loads). */
export async function loadLengthGroupsPageData(
	projectId: string,
	signal?: AbortSignal
): Promise<LengthGroup[]> {
	const inFlight = loadInFlight.get(projectId);
	if (inFlight) return inFlight;

	const promise = listLengthGroups(projectId, signal).finally(() => {
		loadInFlight.delete(projectId);
	});

	loadInFlight.set(projectId, promise);
	return promise;
}

export function upsertLengthGroupInList(groups: LengthGroup[], group: LengthGroup): LengthGroup[] {
	const existing = groups.find((entry) => entry.id === group.id);
	return existing
		? groups.map((entry) => (entry.id === group.id ? group : entry))
		: [...groups, group];
}

export function removeLengthGroupFromList(groups: LengthGroup[], groupId: string): LengthGroup[] {
	return groups.filter((group) => group.id !== groupId);
}
