/** Max rows requested when listing `proj_bom_items` (datahub v2 default is 100, cap is 5000). */
export const PROJ_BOM_ITEMS_LIST_LIMIT = 2500;

/** Build a datahub list path for `proj_bom_items` with the standard row ceiling. */
export function projBomItemsListPath(
	filters: Record<string, string | undefined>,
	options?: { orderBy?: string; limit?: number; select?: string; groupBy?: string }
): string {
	const params = new URLSearchParams({
		limit: String(options?.limit ?? PROJ_BOM_ITEMS_LIST_LIMIT)
	});
	for (const [key, value] of Object.entries(filters)) {
		if (value) params.set(key, value);
	}
	if (options?.orderBy) params.set('orderBy', options.orderBy);
	if (options?.select) params.set('select', options.select);
	if (options?.groupBy) params.set('groupBy', options.groupBy);
	return `proj_bom_items?${params.toString()}`;
}
