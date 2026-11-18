import { apiClient } from '../../lib/api/api-client.js';
import { ApiError } from '../../lib/api/api-error.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';

const LIST_LIMIT = 5000;

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

/** Keep `__in=` query strings under proxy/header limits (HTTP 431). */
function chunkIds(ids: string[], maxEncodedLen = 2500): string[][] {
	const unique = [...new Set(ids.filter(Boolean))];
	const chunks: string[][] = [];
	let current: string[] = [];
	let encodedLen = 0;
	for (const id of unique) {
		const piece = encodeURIComponent(id);
		const next = encodedLen === 0 ? piece.length : encodedLen + 1 + piece.length;
		if (current.length > 0 && next > maxEncodedLen) {
			chunks.push(current);
			current = [];
			encodedLen = 0;
		}
		current.push(id);
		encodedLen = encodedLen === 0 ? piece.length : encodedLen + 1 + piece.length;
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

export type InvListFilter = Record<string, string | number | boolean | undefined | null>;

function buildQuery(filter: InvListFilter): string {
	const qs = new URLSearchParams();
	for (const [key, value] of Object.entries(filter)) {
		if (value === undefined || value === null || value === '') continue;
		qs.set(key, String(value));
	}
	if (!qs.has('limit')) qs.set('limit', String(LIST_LIMIT));
	return qs.toString();
}

export async function invList<T extends Record<string, unknown>>(
	entity: string,
	filter: InvListFilter = {},
	signal?: AbortSignal
): Promise<T[]> {
	const query = buildQuery(filter);
	const envelope = await apiClient.get<ApiEnvelope<T[]>>(apiClient.datahub(`${entity}?${query}`), {
		signal
	});
	return rowsFromEnvelope<T>(envelope.data);
}

export async function invListByIds<T extends Record<string, unknown>>(
	entity: string,
	idColumn: string,
	ids: string[],
	select: string,
	signal?: AbortSignal
): Promise<T[]> {
	if (ids.length === 0) return [];
	const rows: T[] = [];
	for (const chunk of chunkIds(ids)) {
		const envelope = await apiClient.get<ApiEnvelope<T[]>>(
			apiClient.datahub(
				`${entity}?limit=${LIST_LIMIT}&${idColumn}__in=${idListParam(chunk)}&select=${select}`
			),
			{ signal }
		);
		rows.push(...rowsFromEnvelope<T>(envelope.data));
	}
	return rows;
}

export async function invCreate<T extends Record<string, unknown>>(
	entity: string,
	data: Record<string, unknown>,
	signal?: AbortSignal
): Promise<T> {
	const envelope = await apiClient.post<ApiEnvelope<T>>(apiClient.datahub(entity), data, {
		signal
	});
	const row = rowsFromEnvelope<T>(envelope.data)[0];
	if (!row) throw new Error(`invCreate(${entity}) returned no data`);
	return row;
}

export async function invCreateMany<T = unknown>(
	entity: string,
	rows: Record<string, unknown>[],
	signal?: AbortSignal
): Promise<T> {
	const envelope = await apiClient.post<ApiEnvelope<T>>(
		apiClient.datahub(`${entity}/bulk`),
		{ rows },
		{ signal }
	);
	return envelope.data as T;
}

export async function invUpdate<T extends Record<string, unknown>>(
	entity: string,
	id: string,
	data: Record<string, unknown>,
	signal?: AbortSignal
): Promise<T> {
	const envelope = await apiClient.patch<ApiEnvelope<T>>(
		apiClient.datahub(`${entity}/${encodeURIComponent(id)}`),
		data,
		{ signal }
	);
	const row = rowsFromEnvelope<T>(envelope.data)[0];
	if (!row) throw new Error(`invUpdate(${entity}) returned no data`);
	return row;
}

export async function invDelete(entity: string, id: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`${entity}/${encodeURIComponent(id)}`), { signal });
}

/**
 * Atomic multi-op write. Gateway may not expose /txn yet - callers that need
 * atomicity should prefer this; on unavailable fall back to sequential CRUD.
 * // ponytail: gateway /txn still pre-prod (ROADMAP); try then fall back
 *
 * Today POST …/datahub/txn is routed as CRUD entity "txn" → 400
 * `Entity not allowed: txn` (not 404/405). Treat that as unavailable too.
 */
export function isInvTxnUnavailable(error: unknown): boolean {
	if (!(error instanceof ApiError)) return false;
	if (error.status === 404 || error.status === 405) return true;
	if (error.status !== 400) return false;
	return (
		error.details?.some((detail) => /entity not allowed:\s*txn/i.test(detail.message)) === true ||
		/entity not allowed:\s*txn/i.test(error.message)
	);
}

export async function invTxn(
	ops: Array<{
		op: 'create' | 'update' | 'delete';
		entity: string;
		id?: string;
		data?: Record<string, unknown>;
	}>,
	signal?: AbortSignal
): Promise<unknown> {
	const envelope = await apiClient.post<ApiEnvelope<unknown>>(
		apiClient.datahub('txn'),
		{ ops },
		{ signal }
	);
	return envelope.data;
}
