<script lang="ts">
	import { onMount } from 'svelte';
	import { ConfirmationDialog, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { CalendarRange, EllipsisVertical, Trash2 } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load';
	import { resolveDefaultPlanningPlantId } from '../../central-planning-app/lib/planning-plant';
	import {
		deleteSentShopFloorPlan,
		formatPlanCreatedAt,
		listSentPlanMonths
	} from '../../central-planning-app/lib/planning-sheet.store';
	import type { SentPlanMonthRow } from '../../central-planning-app/lib/planning-sheet.types';
	import { clearShopFloorOverlay } from '../lib/sfp-planning-sheet.store';
	import { rmiPushToast } from '../../rm-indent-app/lib/toast';
	import { SHOP_FLOOR_APP_NAME } from '../lib/app-name.js';

	let rows = $state<SentPlanMonthRow[]>([]);
	let isLoading = $state(true);
	let defaultPlantId = $state('');
	let isDeleteDialogOpen = $state(false);
	let rowToDelete = $state<SentPlanMonthRow | null>(null);
	let isBusy = $state(false);

	async function refresh(plantId = defaultPlantId) {
		if (!plantId) {
			rows = [];
			return;
		}
		isLoading = true;
		try {
			rows = await listSentPlanMonths(plantId);
		} catch (error) {
			rmiPushToast({
				title: 'Could not load shop-floor plans',
				description: formatApiErrorMessage(error)
			});
			rows = [];
		} finally {
			isLoading = false;
		}
	}

	function openRow(row: SentPlanMonthRow) {
		window.location.hash = `#/${SHOP_FLOOR_APP_NAME}/Sheet/${encodeURIComponent(row.plan.id)}/${encodeURIComponent(row.month)}`;
	}

	function openDeleteDialog(row: SentPlanMonthRow) {
		if (row.status === 'frozen' && !row.orphaned) {
			rmiPushToast({
				title: 'Month is frozen',
				description: 'Unfreeze this month on the sheet before deleting the shop-floor plan.'
			});
			return;
		}
		rowToDelete = row;
		isDeleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!rowToDelete || isBusy) return;
		const label = rowToDelete.plan.label;
		const month = rowToDelete.month;
		const shopfloorPlanId = rowToDelete.shopfloorPlanId;
		isBusy = true;
		try {
			await deleteSentShopFloorPlan(shopfloorPlanId);
			clearShopFloorOverlay(shopfloorPlanId);
			isDeleteDialogOpen = false;
			rowToDelete = null;
			await refresh();
			rmiPushToast({
				title: 'Shop-floor plan deleted',
				description: `${label} · ${formatMonthLabel(month)}`
			});
		} catch (error) {
			rmiPushToast({
				title: 'Could not delete',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isBusy = false;
		}
	}

	function statusLabel(row: SentPlanMonthRow): {
		variant: 'online' | 'secondary' | 'offline';
		label: string;
	} {
		if (row.status === 'frozen') {
			return {
				variant: 'offline',
				label: row.orphaned ? 'Frozen (orphan)' : 'Frozen'
			};
		}
		const sent = row.sentAt ? Date.parse(row.sentAt) : NaN;
		const edited = row.editedAt ? Date.parse(row.editedAt) : NaN;
		if (Number.isFinite(edited) && Number.isFinite(sent) && edited > sent) {
			return { variant: 'online', label: 'Edited' };
		}
		return { variant: 'secondary', label: 'Draft' };
	}

	const columns = $derived.by((): DataTableColumn<SentPlanMonthRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = rows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{
			type: 'text',
			key: 'label',
			header: 'Plan',
			sortable: true,
			filterable: true,
			dataType: 'string',
			class: 'font-medium text-primary',
			value: (row) => row.plan.label
		},
		{
			type: 'text',
			key: 'month',
			header: 'Month',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatMonthLabel(row.month)
		},
		{
			type: 'badge',
			key: 'sfpStatus',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: (row) => statusLabel(row)
		},
		{
			type: 'text',
			key: 'updatedAt',
			header: 'Updated',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatPlanCreatedAt(row.editedAt || row.sentAt || row.plan.updatedAt || '')
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: () => [
				{
					type: 'dropdown',
					icon: EllipsisVertical,
					align: 'end',
					ariaLabel: 'More actions',
					items: () => [
						[
							{
								label: 'Delete',
								icon: Trash2,
								onClick: (row) => openDeleteDialog(row)
							}
						]
					]
				}
			]
		}
	]);

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				defaultPlantId = await resolveDefaultPlanningPlantId(controller.signal);
				await refresh(defaultPlantId);
			} catch (error) {
				rmiPushToast({
					title: 'Could not load shop-floor plans',
					description: formatApiErrorMessage(error)
				});
				isLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="min-h-0 flex-1">
		<DataTable
			{columns}
			{rows}
			loading={isLoading}
			rowKey={(row) => `${row.shopfloorPlanId}:${row.month}`}
			onRowClick={(row) => openRow(row)}
			emptyState={{
				icon: CalendarRange,
				title: 'No months on the shop floor',
				description: 'Send a month from a Central Planning sheet to see it here.'
			}}
			pagination={{ pageSize: 10 }}
		/>
	</div>
</div>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete shop-floor plan"
	description={rowToDelete
		? rowToDelete.orphaned
			? `Delete orphaned "${rowToDelete.plan.label}" for ${formatMonthLabel(rowToDelete.month)}? The central plan is already gone; this removes the leftover frozen shop-floor month.`
			: `Delete "${rowToDelete.plan.label}" for ${formatMonthLabel(rowToDelete.month)}? This removes the shop-floor commitment for that month. The central plan is unchanged.`
		: 'Delete this shop-floor plan? This cannot be undone.'}
	confirmLabel={isBusy ? 'Deleting…' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={() => void confirmDelete()}
/>
