import { fetchProjectForPage } from './load-project.js';
import type { Project } from '../store.svelte.js';

export type ProjectDashboardData = {
	project: Project | null;
};

export async function loadProjectDashboardData(
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectDashboardData> {
	const project = await fetchProjectForPage(projectId, signal);
	return { project };
}
