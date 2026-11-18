export type KanbanColumn = {
	id: string;
	title: string;
	/** Optional action label shown in column header (e.g. Create). */
	actionLabel?: string;
};

export type KanbanItemField = {
	label: string;
	value: string;
};

export type KanbanItem = {
	id: string;
	columnId: string;
	title: string;
	subtitle?: string;
	/** Right-side badge text (e.g. quantity). */
	badge?: string;
	/** Secondary badge (e.g. date). */
	metaBadge?: string;
	fields?: KanbanItemField[];
	disabled?: boolean;
};

export type KanbanItemMoveDetail = {
	itemId: string;
	fromColumnId: string;
	toColumnId: string;
	toIndex: number;
};

/** MIME type for native drag payload. */
export const KANBAN_DRAG_MIME = 'application/x-kanban-item';
