import { describe, expect, it } from 'vitest';
import { actionsSkeletonLayout } from './table-skeleton.utils';
import type { TableColumn } from './table.constants';

type Row = { id: string };

function actionsColumn(
	actions: Extract<TableColumn<Row>, { type: 'actions' }>['actions']
): TableColumn<Row> {
	return {
		key: 'actions',
		header: 'Actions',
		type: 'actions',
		actions
	};
}

describe('actionsSkeletonLayout', () => {
	it('renders labeled button and icon menu for View + dropdown columns', () => {
		const layout = actionsSkeletonLayout(
			actionsColumn(() => [
				{ type: 'button', label: 'View', variant: 'primary', size: 'sm' },
				{ type: 'dropdown', ariaLabel: 'More actions' }
			])
		);

		expect(layout).toEqual({
			align: 'end',
			showLeading: false,
			labeledButtonCount: 1,
			iconButtonCount: 0,
			showMenu: true
		});
	});

	it('renders icon button and icon menu for icon + dropdown columns', () => {
		const layout = actionsSkeletonLayout(
			actionsColumn(() => [
				{ type: 'button', size: 'icon', ariaLabel: 'Edit' },
				{ type: 'dropdown', ariaLabel: 'More actions' }
			])
		);

		expect(layout).toEqual({
			align: 'end',
			showLeading: false,
			labeledButtonCount: 0,
			iconButtonCount: 1,
			showMenu: true
		});
	});

	it('renders only the icon menu when the column is menu-only', () => {
		const layout = actionsSkeletonLayout(
			actionsColumn(() => [{ type: 'dropdown', ariaLabel: 'More actions' }])
		);

		expect(layout).toEqual({
			align: 'end',
			showLeading: false,
			labeledButtonCount: 0,
			iconButtonCount: 0,
			showMenu: true
		});
	});

	it('includes leading text when configured', () => {
		const layout = actionsSkeletonLayout({
			key: 'actions',
			header: 'Actions',
			type: 'actions',
			leading: () => ({ label: 'Assigned to' }),
			actions: () => [{ type: 'dropdown', ariaLabel: 'More actions' }]
		});

		expect(layout.showLeading).toBe(true);
		expect(layout.showMenu).toBe(true);
	});
});
