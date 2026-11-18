/**
 * Typed helpers for `GET /api/v2/datahub/:entity` including Phase-2 `joins=`.
 * Contract: ifactoryai-core docs/DATAHUB_QUERY_API.md §8.
 */

import { apiClient } from './api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from './types.js';

export type JoinType = 'left' | 'inner' | 'right' | 'full';

export type JoinPredicate = {
	leftField: string;
	op: 'eq';
	rightField: string;
};

export type DynamicJoin = {
	entity: string;
	alias: string;
	type?: JoinType;
	on: JoinPredicate[];
};

const RESERVED = new Set([
	'select',
	'joins',
	'filters',
	'orderBy',
	'order_by',
	'groupBy',
	'group_by',
	'distinctOn',
	'distinct_on',
	'limit',
	'offset'
]);

export type DatahubQueryOptions = {
	select?: string;
	joins?: DynamicJoin[];
	/** Flat filter array or nested AND/OR group — JSON-encoded as `filters=`. */
	filters?: unknown;
	orderBy?: string;
	groupBy?: string;
	distinctOn?: string;
	limit?: number | string;
	offset?: number | string;
	/** Flat `eq` / `col__op` filters and any other query params. */
	[key: string]: unknown;
};

/** Read a joined column (`"alias.col"`); falls back to bare `col` for the main entity. */
export function pickAlias(row: Record<string, unknown>, alias: string, col: string): unknown {
	const namespaced = row[`${alias}.${col}`];
	if (namespaced !== undefined) return namespaced;
	return row[col];
}

export function pickAliasString(
	row: Record<string, unknown>,
	alias: string,
	col: string,
	fallback = ''
): string {
	const value = pickAlias(row, alias, col);
	return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function buildQuery(options: DatahubQueryOptions): string {
	const qs = new URLSearchParams();
	const { select, joins, filters, orderBy, groupBy, distinctOn, limit, offset, ...flat } = options;

	if (select != null && select !== '') qs.set('select', String(select));
	if (joins != null && joins.length > 0) qs.set('joins', JSON.stringify(joins));
	if (filters != null) qs.set('filters', JSON.stringify(filters));
	if (orderBy != null && orderBy !== '') qs.set('orderBy', String(orderBy));
	if (groupBy != null && groupBy !== '') qs.set('groupBy', String(groupBy));
	if (distinctOn != null && distinctOn !== '') qs.set('distinctOn', String(distinctOn));
	if (limit != null && limit !== '') qs.set('limit', String(limit));
	if (offset != null && offset !== '') qs.set('offset', String(offset));

	for (const [key, value] of Object.entries(flat)) {
		if (RESERVED.has(key)) continue;
		if (value === undefined || value === null || value === '') continue;
		qs.set(key, String(value));
	}

	if (!qs.has('limit')) qs.set('limit', '5000');
	return qs.toString();
}

/** One-shot list/query against a registered datahub entity (optionally with joins). */
export async function datahubQuery<T extends Record<string, unknown> = Record<string, unknown>>(
	entity: string,
	options: DatahubQueryOptions = {},
	signal?: AbortSignal
): Promise<T[]> {
	const query = buildQuery(options);
	const envelope = await apiClient.get<ApiEnvelope<T[]>>(apiClient.datahub(`${entity}?${query}`), {
		signal
	});
	return rowsFromEnvelope<T>(envelope.data);
}

/** Convenience: LEFT (default) equi-join on matching column names. */
export function leftJoin(
	entity: string,
	alias: string,
	leftField: string,
	rightField: string
): DynamicJoin {
	return {
		entity,
		alias,
		type: 'left',
		on: [{ leftField, op: 'eq', rightField }]
	};
}
