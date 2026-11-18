import { datahubQuery, leftJoin } from '../../lib/api/datahub-query.js';
import { num } from './inv.num.js';

export type IndentProcureKey = {
	projectId: string;
	itemId: string;
	section: string;
	lengthMm: number;
};

/** Sum procure_qty_base already raised for project + item + length across all indents. */
export async function loadProcuredQtyBySection(
	projectId: string,
	signal?: AbortSignal
): Promise<Map<string, number>> {
	const lines = await datahubQuery<Record<string, unknown>>(
		'inv_indent_lines',
		{
			select: 'indent_id,item_id,variant_key,procure_qty_base',
			joins: [leftJoin('inv_indents', 'h', 'indent_id', 'h.indent_id')],
			filters: [{ column: 'h.project_id', op: 'eq', value: projectId }]
		},
		signal
	);

	const procured = new Map<string, number>();
	for (const line of lines) {
		const itemId = typeof line.item_id === 'string' ? line.item_id : '';
		const variant = typeof line.variant_key === 'string' ? line.variant_key : '';
		const lengthMatch = /(?:^|[|])L=(\d+)/.exec(variant);
		const lengthMm = lengthMatch ? Number(lengthMatch[1]) : 0;
		const key = procureKey({ projectId, itemId, section: '', lengthMm });
		const qty = num(line.procure_qty_base);
		procured.set(key, (procured.get(key) ?? 0) + qty);
	}
	return procured;
}

export function procureKey(input: IndentProcureKey): string {
	const id = input.itemId || input.section || '';
	return `${input.projectId}|${id}|${Math.round(input.lengthMm)}`;
}

export function remainingToProcure(requiredQty: number, alreadyProcured: number): number {
	return Math.max(0, requiredQty - alreadyProcured);
}
