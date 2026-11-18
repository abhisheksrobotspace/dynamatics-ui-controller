import type { TableAction, TableColumn, TableColumnAlign } from './table.constants';

export type ActionsSkeletonLayout = {
	align: TableColumnAlign;
	showLeading: boolean;
	labeledButtonCount: number;
	iconButtonCount: number;
	showMenu: boolean;
};

const EMPTY_LAYOUT: ActionsSkeletonLayout = {
	align: 'end',
	showLeading: false,
	labeledButtonCount: 0,
	iconButtonCount: 0,
	showMenu: false
};

function sampleActions<T>(column: Extract<TableColumn<T>, { type: 'actions' }>): TableAction<T>[] {
	try {
		return column.actions({} as T);
	} catch {
		return [];
	}
}

function isIconMenuAction<T>(action: TableAction<T>): boolean {
	return action.type === 'dropdown' && !action.label;
}

function isLabeledButton<T>(action: TableAction<T>): boolean {
	return (
		action.type !== 'dropdown' &&
		action.type !== 'label' &&
		action.type !== 'badge' &&
		Boolean(action.label)
	);
}

function isIconOnlyButton<T>(action: TableAction<T>): boolean {
	return (
		action.type !== 'dropdown' &&
		action.type !== 'label' &&
		action.type !== 'badge' &&
		!action.label
	);
}

/** Infer skeleton chrome from an actions column without a real row. */
export function actionsSkeletonLayout<T>(column: TableColumn<T>): ActionsSkeletonLayout {
	if (column.type !== 'actions') {
		return EMPTY_LAYOUT;
	}

	const align = column.align ?? 'end';
	const showLeading = typeof column.leading === 'function';
	const sample = sampleActions(column);
	const labeledButtonCount = sample.filter(isLabeledButton).length;
	const iconButtonCount = sample.filter(isIconOnlyButton).length;
	const showMenu = sample.some(isIconMenuAction);

	if (labeledButtonCount > 0 || iconButtonCount > 0 || showLeading || showMenu) {
		return { align, showLeading, labeledButtonCount, iconButtonCount, showMenu };
	}

	if (align === 'start') {
		return {
			align,
			showLeading: false,
			labeledButtonCount: 2,
			iconButtonCount: 0,
			showMenu: false
		};
	}

	return { align, showLeading: false, labeledButtonCount: 0, iconButtonCount: 0, showMenu: true };
}
