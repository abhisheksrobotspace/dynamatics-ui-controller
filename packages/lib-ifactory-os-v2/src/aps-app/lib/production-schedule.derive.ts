import type { ScheduleTreeNode } from '@ifactory/ui-v2';

export const UNASSIGNED_ORDER_ID = 'unassigned';

const RM_NODE_SEP = '::rm::';
const MARK_NODE_SEP = '::mark::';

export function rmTreeNodeId(cardId: string, rmId: string): string {
	return `${cardId}${RM_NODE_SEP}${rmId}`;
}

export function markTreeNodeId(cardId: string, rmId: string, markNo: string): string {
	return `${rmTreeNodeId(cardId, rmId)}${MARK_NODE_SEP}${markNo}`;
}

export function isRmTreeNodeId(id: string): boolean {
	return id.includes(RM_NODE_SEP) && !id.includes(MARK_NODE_SEP);
}

export function isMarkTreeNodeId(id: string): boolean {
	return id.includes(MARK_NODE_SEP);
}

export function sectionIdFromTreeNodeId(id: string): string {
	const index = id.indexOf(RM_NODE_SEP);
	return index >= 0 ? id.slice(0, index) : id;
}

export type JobCardTreeRow = {
	job_card_id: string;
	work_order_id?: string | null;
	tower_label?: string | null;
	bom_name?: string | null;
	section?: string | null;
	card_no: number | string;
	status?: string | null;
	total_weight_mt?: string | number | null;
};

export type ScheduleTaskLabelInput = {
	task_id: string;
	task_kind?: string | null;
	product?: string | null;
	mark_no?: string | null;
	unit_index?: number | null;
	bundle_index?: number | null;
};

export type UnitTaskMarkSource = {
	task_id: string;
	job_card_id?: string | null;
	task_kind?: string | null;
	start_time?: string | null;
	end_time?: string | null;
	machine_id?: string | null;
	rm_id?: string | null;
	mark_no?: string | null;
	unit_index?: number | null;
	qty?: number | null;
	metadata?: { marks?: unknown } | null;
};

export type FlattenedUnitMark = {
	mark_no: string;
	job_card_line_id?: string;
	qty?: number | null;
	length_mm?: number | null;
	machine_id?: string | null;
	rm_id?: string | null;
	bar: number;
	start_time?: string | null;
	end_time?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function marksArray(metadata: UnitTaskMarkSource['metadata']): unknown[] {
	const raw = metadata?.marks;
	return Array.isArray(raw) ? raw : [];
}

function textField(row: Record<string, unknown>, ...keys: string[]): string {
	for (const key of keys) {
		const value = row[key];
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return '';
}

function numberField(row: Record<string, unknown>, ...keys: string[]): number | null {
	for (const key of keys) {
		const value = row[key];
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (typeof value === 'string' && value.trim()) {
			const n = Number(value);
			if (Number.isFinite(n)) return n;
		}
	}
	return null;
}

/** Option B: unit-task metadata.marks in cut order. Empty until solver stamps marks. */
export function flattenUnitTaskMarks(
	tasks: UnitTaskMarkSource[],
	cardId: string,
	taskId?: string | null
): FlattenedUnitMark[] {
	return tasks
		.filter(
			(task) =>
				task.task_kind === 'unit' &&
				task.job_card_id === cardId &&
				(!taskId || task.task_id === taskId)
		)
		.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
		.flatMap((task) =>
			marksArray(task.metadata).map((entry) => {
				const mark = asRecord(entry) ?? {};
				return {
					mark_no: textField(mark, 'mark_no', 'markNo'),
					job_card_line_id: textField(mark, 'job_card_line_id') || undefined,
					qty: numberField(mark, 'qty', 'quantity') ?? task.qty ?? null,
					length_mm: numberField(mark, 'length_mm', 'lengthMm'),
					machine_id: task.machine_id,
					rm_id: task.rm_id,
					bar: (task.unit_index ?? 0) + 1,
					start_time: textField(mark, 'start_time', 'start') || task.start_time || null,
					end_time: textField(mark, 'end_time', 'end') || task.end_time || null
				};
			})
		)
		.filter((mark) => Boolean(mark.mark_no));
}

/** Doc §6: task.job_card_id is the order; NULL → Unassigned. */
export function taskOrderId(jobCardId: string | null | undefined): string {
	return jobCardId?.trim() || UNASSIGNED_ORDER_ID;
}

export function formatScheduleTaskLabel(row: ScheduleTaskLabelInput): string {
	if (row.task_kind === 'unit') {
		const product = row.product?.trim() || 'Unit';
		return `${product} · bar ${(row.unit_index ?? 0) + 1}`;
	}
	if (row.task_kind === 'bundle') {
		const mark = row.mark_no?.trim() || 'Mark';
		return `${mark} · Bundle ${(row.bundle_index ?? 0) + 1}`;
	}
	return row.mark_no?.trim() || row.product?.trim() || row.task_id;
}

function barPart(value: string | number | null | undefined): string {
	if (value == null) return '-';
	const text = String(value).trim();
	return text || '-';
}

function barTonnage(mt: string | number | null | undefined): string {
	const n = typeof mt === 'number' ? mt : Number(mt);
	if (!Number.isFinite(n) || n <= 0) return '-';
	return `${n.toFixed(2)} MT`;
}

/** Gantt bar: section • tower • BOM • tonnage */
export function formatGanttBarLabel(
	card?: Pick<JobCardTreeRow, 'section' | 'tower_label' | 'bom_name' | 'total_weight_mt'> | null,
	fallbackSection?: string | null
): string {
	return [
		barPart(card?.section || fallbackSection),
		barPart(card?.tower_label),
		barPart(card?.bom_name),
		barTonnage(card?.total_weight_mt)
	].join(' • ');
}

/** Doc §6: card leaf is `M-<card_no>` · `section`. */
export function formatJobCardLeafLabel(card: JobCardTreeRow): string {
	const sr = `M-${card.card_no}`;
	const section = card.section?.trim();
	return section ? `${sr} · ${section}` : sr;
}

function findTreeNode(nodes: ScheduleTreeNode[], id: string): ScheduleTreeNode | null {
	for (const node of nodes) {
		if (node.id === id) return node;
		if (node.children?.length) {
			const found = findTreeNode(node.children, id);
			if (found) return found;
		}
	}
	return null;
}

function rmidNodesForCard(cardId: string, tasks: UnitTaskMarkSource[]): ScheduleTreeNode[] {
	const marksByRm = new Map<string, Set<string>>();
	for (const mark of flattenUnitTaskMarks(tasks, cardId)) {
		const rmId = mark.rm_id?.trim();
		if (!rmId) continue;
		let marks = marksByRm.get(rmId);
		if (!marks) {
			marks = new Set();
			marksByRm.set(rmId, marks);
		}
		if (mark.mark_no) marks.add(mark.mark_no);
	}
	for (const task of tasks) {
		if (task.task_kind !== 'unit' || task.job_card_id !== cardId) continue;
		const rmId = task.rm_id?.trim();
		if (rmId && !marksByRm.has(rmId)) marksByRm.set(rmId, new Set());
	}

	return [...marksByRm.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([rmId, marks]) => {
			const markNodes = [...marks]
				.sort((a, b) => a.localeCompare(b))
				.map((markNo) => ({
					id: markTreeNodeId(cardId, rmId, markNo),
					label: markNo
				}));
			return {
				id: rmTreeNodeId(cardId, rmId),
				label: rmId,
				...(markNodes.length > 0 ? { children: markNodes } : {})
			};
		});
}

function collectSectionIds(node: ScheduleTreeNode): string[] {
	if (isRmTreeNodeId(node.id) || isMarkTreeNodeId(node.id)) {
		return [sectionIdFromTreeNodeId(node.id)];
	}
	if (!node.children?.length) {
		return node.id === 'all' || node.id.startsWith('wo-') ? [] : [node.id];
	}
	const firstChildId = node.children[0]?.id ?? '';
	if (isRmTreeNodeId(firstChildId) || isMarkTreeNodeId(firstChildId)) {
		return [node.id];
	}
	return node.children.flatMap(collectSectionIds);
}

/** Gantt ids to keep fully visible for a tree selection. `null` = show all. */
export function ganttHighlightIdsForTreeSelection(
	tree: ScheduleTreeNode[],
	selectedId: string
): string[] | null {
	if (!selectedId || selectedId === 'all') return null;
	const node = findTreeNode(tree, selectedId);
	if (!node) return null;
	if (isRmTreeNodeId(selectedId) || isMarkTreeNodeId(selectedId)) return [selectedId];
	const ids = collectSectionIds(node);
	return ids.length > 0 ? ids : null;
}

/** Identities a Gantt bar matches for RMID / marking tree highlighting. */
export function taskGanttHighlightIds(
	row: UnitTaskMarkSource,
	all: UnitTaskMarkSource[] = [row]
): string[] {
	const cardId = taskOrderId(row.job_card_id);
	const ids = new Set<string>([cardId]);
	if (row.task_kind === 'unit') {
		const rmId = row.rm_id?.trim();
		if (rmId) ids.add(rmTreeNodeId(cardId, rmId));
		for (const mark of flattenUnitTaskMarks(all, cardId, row.task_id)) {
			const markRm = mark.rm_id?.trim() || rmId;
			if (markRm && mark.mark_no) ids.add(markTreeNodeId(cardId, markRm, mark.mark_no));
		}
	} else if (row.task_kind === 'bundle') {
		const markNo = row.mark_no?.trim();
		if (markNo) {
			for (const mark of flattenUnitTaskMarks(all, cardId)) {
				if (mark.mark_no !== markNo) continue;
				const markRm = mark.rm_id?.trim();
				if (markRm) ids.add(markTreeNodeId(cardId, markRm, markNo));
			}
		}
	}
	return [...ids];
}

/** Explorer: WO → tower → BOM → section → RMID → marking. Skip cancelled. */
export function buildJobCardOrderTree(
	cards: JobCardTreeRow[],
	hasUnassigned: boolean,
	tasks: UnitTaskMarkSource[] = []
): ScheduleTreeNode[] {
	type BomNode = { id: string; label: string; cards: ScheduleTreeNode[] };
	type TowerNode = { id: string; label: string; boms: Map<string, BomNode> };
	type WoNode = { id: string; label: string; towers: Map<string, TowerNode> };

	const wos = new Map<string, WoNode>();
	for (const card of cards) {
		if (card.status === 'cancelled') continue;
		const woKey = card.work_order_id?.trim() || 'unknown-wo';
		const woLabel = card.work_order_id?.trim() || 'Unknown WO';
		let wo = wos.get(woKey);
		if (!wo) {
			wo = { id: `wo-${woKey}`, label: woLabel, towers: new Map() };
			wos.set(woKey, wo);
		}

		const towerKey = card.tower_label?.trim() || '-';
		let tower = wo.towers.get(towerKey);
		if (!tower) {
			tower = { id: `${wo.id}::tower-${towerKey}`, label: towerKey, boms: new Map() };
			wo.towers.set(towerKey, tower);
		}

		const bomKey = card.bom_name?.trim() || '-';
		let bom = tower.boms.get(bomKey);
		if (!bom) {
			bom = { id: `${tower.id}::bom-${bomKey}`, label: bomKey, cards: [] };
			tower.boms.set(bomKey, bom);
		}
		if (!bom.cards.some((leaf) => leaf.id === card.job_card_id)) {
			const rmChildren = rmidNodesForCard(card.job_card_id, tasks);
			bom.cards.push({
				id: card.job_card_id,
				label: card.section?.trim() || formatJobCardLeafLabel(card),
				...(rmChildren.length > 0 ? { children: rmChildren } : {})
			});
		}
	}

	const children: ScheduleTreeNode[] = [...wos.values()].map((wo) => ({
		id: wo.id,
		label: wo.label,
		children: [...wo.towers.values()].map((tower) => ({
			id: tower.id,
			label: tower.label,
			children: [...tower.boms.values()].map((bom) => ({
				id: bom.id,
				label: bom.label,
				children: bom.cards
			}))
		}))
	}));

	if (hasUnassigned) {
		children.push({ id: UNASSIGNED_ORDER_ID, label: 'Unassigned' });
	}

	return [{ id: 'all', label: 'All orders', children }];
}
