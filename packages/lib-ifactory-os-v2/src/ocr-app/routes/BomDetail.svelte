<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { FileText, Layers } from '@lucide/svelte';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { errorDescription } from '../../lib/api/types.js';
	import {
		isBomExtractReady,
		type BomExtractStatus
	} from '../../project-management-app/lib/bom-extract-status.js';
	import {
		bomExtractStatusBadge,
		bomFileDisplayStatusBadge
	} from '../../project-management-app/lib/projects/bom-status-badges.js';
	import { getBomById } from '../../project-management-app/lib/projects/boms.api.js';
	import {
		buildDrawingSetListRows,
		listBomDrawingFiles,
		type BomDrawingSetListRow
	} from '../../project-management-app/lib/projects/drawing-sets.api.js';
	import type { BomConfig } from '../../project-management-app/lib/store.svelte.js';
	import {
		bomStructureFromParams,
		ocrBomItemsHash,
		ocrDrawingSetHash,
		structureId
	} from '../lib/ocr-routes.js';
	import { ocrPushErrorToast } from '../lib/toast.js';

	let {
		params
	}: {
		params: { projectId: string; towerId?: string; stubId?: string; bomId: string };
	} = $props();

	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const structure = $derived(bomStructureFromParams(params));
	const structureKey = $derived(structureId(structure));

	const BOM_DETAIL_FETCH = {
		includeDrawings: false,
		includePublishedCp: false
	} as const;

	const EMPTY_TABLE_STATE_CLASS = 'min-h-48';
	const BOM_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border-0 px-2 py-0 text-xs font-bold text-white font-['Space_Grotesk']";

	type BomFileRow = {
		id: string;
		fileName: string;
		extractStatus: BomExtractStatus;
		updated: string;
	};

	type DrawingSetRow = BomDrawingSetListRow;

	let bom = $state<BomConfig | null>(null);
	let drawingSets = $state<DrawingSetRow[]>([]);
	let isLoading = $state(true);

	const hasDrawingSets = $derived(drawingSets.length > 0);
	const useCompactDrawingSetTable = $derived(isLoading || !hasDrawingSets);

	const bomFileRows = $derived.by((): BomFileRow[] => {
		const current = bom;
		if (!current?.bomFileId && !current?.bomFile) return [];
		return [
			{
				id: current.id,
				fileName: current.bomFile?.trim() || 'BOM file',
				extractStatus: current.extractStatus,
				updated: current.bomFileUploadedAt ? formatUtcAsIst(current.bomFileUploadedAt) : '—'
			}
		];
	});

	function handleViewBomFile() {
		if (!bom || !isBomExtractReady(bom)) return;
		window.location.hash = ocrBomItemsHash(projectId, structure, bomId);
	}

	function handleViewDrawingSet(row: DrawingSetRow) {
		window.location.hash = ocrDrawingSetHash(projectId, structure, bomId, row.name);
	}

	const bomFileColumns = $derived.by((): DataTableColumn<BomFileRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: () => '1'
		},
		{
			type: 'text',
			key: 'fileName',
			header: 'File',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.fileName
		},
		{
			type: 'badge',
			key: 'status',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: (row) => bomExtractStatusBadge(row.extractStatus)
		},
		{
			type: 'text',
			key: 'updated',
			header: 'Uploaded at',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.updated
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: () =>
				bom && isBomExtractReady(bom)
					? [
							{
								type: 'button',
								label: 'View',
								variant: 'primary',
								size: 'sm',
								class: BOM_COL_BTN,
								onClick: () => handleViewBomFile()
							}
						]
					: []
		}
	]);

	const drawingSetColumns = $derived.by((): DataTableColumn<DrawingSetRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(drawingSets.findIndex((set) => set.id === row.id) + 1)
		},
		{
			type: 'text',
			key: 'name',
			header: 'Drawing set',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			type: 'text',
			key: 'files',
			header: 'Files',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.files)
		},
		{
			type: 'badge',
			key: 'status',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: (row) => bomFileDisplayStatusBadge(row.status)
		},
		{
			type: 'text',
			key: 'updated',
			header: 'Uploaded at',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.updated
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: (row) => [
				{
					type: 'button',
					label: 'View',
					variant: 'primary',
					size: 'sm',
					class: BOM_COL_BTN,
					onClick: () => handleViewDrawingSet(row)
				}
			]
		}
	]);

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const [loaded, files] = await Promise.all([
					getBomById(projectId, structureKey, bomId, controller.signal, BOM_DETAIL_FETCH),
					listBomDrawingFiles(bomId, controller.signal)
				]);
				bom = loaded;
				drawingSets = buildDrawingSetListRows(files, loaded?.stage ?? 'proto');
			} catch (err) {
				bom = null;
				drawingSets = [];
				ocrPushErrorToast({
					title: 'Could not load BOM version',
					description: errorDescription(err)
				});
			} finally {
				isLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-y-auto p-3 md:p-4">
	{#if isLoading || bom}
		<div
			class="flex flex-col gap-4 {useCompactDrawingSetTable
				? ''
				: 'min-h-0 flex-1 overflow-hidden'}"
		>
			<div class="relative shrink-0">
				<DataTable
					stickyHeader={false}
					columns={bomFileColumns}
					rows={bomFileRows}
					loading={isLoading}
					skeletonRowCount={1}
					rowKey={(row) => row.id}
					onRowClick={bom && isBomExtractReady(bom) ? handleViewBomFile : undefined}
					search={{
						enabled: true,
						placeholder: 'Search BOM file...'
					}}
					export={{ enabled: false }}
					pagination={{ enabled: false }}
					emptyState={{
						icon: FileText,
						title: 'No BOM file',
						description: 'This version has no BOM CSV uploaded yet.',
						class: EMPTY_TABLE_STATE_CLASS
					}}
				/>
			</div>

			<div class="relative {useCompactDrawingSetTable ? 'shrink-0' : 'min-h-0 flex-1'}">
				<DataTable
					stickyHeader={!useCompactDrawingSetTable}
					skeletonRowCount={useCompactDrawingSetTable ? 1 : undefined}
					class={useCompactDrawingSetTable ? undefined : 'min-h-0 flex-1'}
					columns={drawingSetColumns}
					rows={drawingSets}
					loading={isLoading}
					rowKey={(row) => row.id}
					onRowClick={handleViewDrawingSet}
					search={{
						enabled: true,
						placeholder: 'Search drawing sets...'
					}}
					export={{ enabled: false }}
					pagination={{ pageSize: 10 }}
					emptyState={{
						icon: Layers,
						title: 'No drawing sets',
						description: 'This BOM version has no drawing sets yet.',
						class: EMPTY_TABLE_STATE_CLASS
					}}
				/>
			</div>
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">BOM version not found.</p>
	{/if}
</div>
