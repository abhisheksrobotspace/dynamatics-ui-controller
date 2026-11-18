import { listCustomers } from './customers.api.js';
import {
	projectToBreadcrumb,
	syncProjectBreadcrumbs,
	upsertProjectBreadcrumb
} from './breadcrumb-registry.js';
import { getProjectById, listProjects } from './projects.api.js';
import { projectStore, type Project, type ProjectBreadcrumb } from '../store.svelte.js';
import type { Customer } from './types.js';

let loadProjectsPageInFlight: Promise<{
	projects: Project[];
	customers: Customer[];
}> | null = null;

const projectFetchInFlight = new Map<string, Promise<Project | null>>();

/**
 * Fetches a single project label when missing from the breadcrumb registry (deep-links).
 * Joined customer/contractor names are available but breadcrumbs only use the project name.
 */
export async function ensureProjectBreadcrumb(
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectBreadcrumb | null> {
	const existing = projectStore.projects.find((project) => project.id === projectId);
	if (existing) return existing;

	const project = await getProjectById(projectId, new Map(), new Map(), signal);
	if (!project) return null;

	upsertProjectBreadcrumb(project);
	return projectToBreadcrumb(project);
}

/** @deprecated Use ensureProjectBreadcrumb for shell navigation. */
export const ensureProjectLoaded = ensureProjectBreadcrumb;

/**
 * Loads a full project for a feature page that needs customerName / contractorName
 * (dashboard, etc.) — one joined projects query.
 */
export async function fetchProjectForPage(
	projectId: string,
	signal?: AbortSignal
): Promise<Project | null> {
	const inFlight = projectFetchInFlight.get(projectId);
	if (inFlight) return inFlight;

	const promise = (async () => {
		const project = await getProjectById(projectId, new Map(), new Map(), signal);
		if (project) upsertProjectBreadcrumb(project);
		return project;
	})().finally(() => {
		projectFetchInFlight.delete(projectId);
	});

	projectFetchInFlight.set(projectId, promise);
	return promise;
}

/**
 * Loads the projects list (customer + contractor names via joins).
 * Does not fetch customer/contractor catalogs — open the create/edit dialog for those.
 */
export async function loadProjectsPageData(signal?: AbortSignal): Promise<{
	projects: Project[];
	customers: Customer[];
}> {
	if (loadProjectsPageInFlight) return loadProjectsPageInFlight;

	const promise = (async () => {
		const projects = await listProjects(new Map(), new Map(), signal);
		syncProjectBreadcrumbs(projects);
		return { projects, customers: [] as Customer[] };
	})().finally(() => {
		loadProjectsPageInFlight = null;
	});

	loadProjectsPageInFlight = promise;
	return promise;
}

/** Customer catalog for project create/edit comboboxes (lazy). */
export async function loadProjectCustomerCatalog(signal?: AbortSignal): Promise<Customer[]> {
	return listCustomers(signal);
}

export {
	projectToBreadcrumb,
	syncProjectBreadcrumbs,
	upsertProjectBreadcrumb
} from './breadcrumb-registry.js';
export { removeProjectBreadcrumb } from './breadcrumb-registry.js';
