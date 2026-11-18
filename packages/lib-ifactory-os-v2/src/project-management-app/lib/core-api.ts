// Browser client for ifactoryai-core (the datahub CRUD, Files, and feature-job APIs). Auth is the
// Better Auth SESSION COOKIE — never an x-api-key from the browser (Caddy validates the session and
// injects the service key downstream). All paths are same-origin (relative), so they work when the
// SPA is served from core, and via the Vite `/api/v2` dev proxy locally.

import { toApiErrorFromBody } from '../../lib/api/api-error.js';
import { PROJ_BOM_ITEMS_LIST_LIMIT } from './projects/proj-bom-items.constants.js';

/** Datahub v2 default list page size is 100; hard cap is 5000. */
const DATAHUB_LIST_HIGH_LIMIT = 5000;

/** Entities that routinely exceed the default page size and must request the ceiling. */
const HIGH_LIMIT_ENTITIES = new Set(['proj_bom_items', 'ocr_results', 'ocr_pages']);

async function coreFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		credentials: 'include',
		...init,
		headers: { ...(init?.headers ?? {}) }
	});
	const data = (await res.json().catch(() => ({}))) as {
		success?: boolean;
		data?: T;
		error?: unknown;
	};
	if (!res.ok || data.success === false) {
		throw toApiErrorFromBody(data, res.status);
	}
	return data.data as T;
}

/** Create one row in an allowlisted entity; returns the created row. */
export function datahubCreate<T = Record<string, unknown>>(
	entity: string,
	data: Record<string, unknown>
): Promise<T> {
	return coreFetch<T>(`/api/v2/datahub/${entity}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(data)
	});
}

/** Bulk-insert N rows into one entity (one transaction). */
export function datahubCreateMany<T = unknown>(
	entity: string,
	rows: Record<string, unknown>[]
): Promise<T> {
	return coreFetch<T>(`/api/v2/datahub/${entity}/bulk`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ rows })
	});
}

/** List rows with exact-match filters (e.g. { bom_id }). */
export async function datahubList<T = Record<string, unknown>>(
	entity: string,
	filter: Record<string, string> = {}
): Promise<T[]> {
	const qs = new URLSearchParams(filter);
	if (!qs.has('limit') && HIGH_LIMIT_ENTITIES.has(entity)) {
		qs.set(
			'limit',
			String(entity === 'proj_bom_items' ? PROJ_BOM_ITEMS_LIST_LIMIT : DATAHUB_LIST_HIGH_LIMIT)
		);
	}
	const query = qs.toString();
	const rows = await coreFetch<T[]>(`/api/v2/datahub/${entity}${query ? `?${query}` : ''}`);
	return Array.isArray(rows) ? rows : [];
}

/** Patch one row by primary key (e.g. ocr_results / `{result_id}`). */
export function datahubUpdate<T = Record<string, unknown>>(
	entity: string,
	id: string,
	data: Record<string, unknown>
): Promise<T> {
	return coreFetch<T>(`/api/v2/datahub/${entity}/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(data)
	});
}

/** Delete one row by primary key. */
export function datahubDelete(entity: string, id: string): Promise<void> {
	return coreFetch<void>(`/api/v2/datahub/${entity}/${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
}

/** Upload bytes to file-service, attached to an owning entity; returns the new file_id. */
export async function filesUpload(
	file: File | Blob,
	fileName: string,
	entityType: string,
	entityId: string
): Promise<string> {
	const form = new FormData();
	form.append('entityType', entityType);
	form.append('entityId', entityId);
	form.append('file', file, fileName);
	const row = await coreFetch<{ file_id: string }>(`/api/v2/files`, { method: 'POST', body: form });
	return row.file_id;
}

/** Same-origin URL to stream a file's bytes (usable directly as an <img src>; cookie rides along). */
export function fileDownloadUrl(fileId: string): string {
	return `/api/v2/files/${encodeURIComponent(fileId)}`;
}

/** Trigger an async feature job; returns the created async_jobs row. */
export function triggerJob(
	feature: string,
	request: Record<string, unknown>
): Promise<{ job_id: string; status: string }> {
	return coreFetch(`/api/v2/datahub/jobs/${feature}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ request })
	});
}

export interface AsyncJobRow {
	job_id: string;
	status: 'queued' | 'dispatched' | 'processing' | 'completed' | 'failed';
	progress?: number;
	result_ref?: unknown;
	error?: string | null;
	metadata?: { error_code?: string; [key: string]: unknown } | null;
}

/** Status-poll columns — omits jsonb `request` (same select as `lib/api/jobs`). */
const ASYNC_JOB_POLL_SELECT =
	'job_id,status,progress,result_ref,error,metadata,created_at,updated_at';

/** Read one async_jobs row by id (slim — no `request` payload). */
export async function getJob(jobId: string): Promise<AsyncJobRow | null> {
	const rows = await datahubList<AsyncJobRow>('async_jobs', {
		job_id: jobId,
		select: ASYNC_JOB_POLL_SELECT
	});
	return rows[0] ?? null;
}
