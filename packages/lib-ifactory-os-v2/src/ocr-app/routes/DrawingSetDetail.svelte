<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type BadgeCell, type DataTableColumn } from '@ifactory/ui-v2';
	import { FileText } from '@lucide/svelte';
	import { writeOcrGenerateSession } from '../lib/ocr-generate-session.js';
	import { isExtractionRunning } from '../lib/operations-count-extraction.svelte.js';
	import { drawingFileStatusBadge } from '../lib/drawing-file-status.js';
	import { listOcrDrawingFiles, type OcrDrawingFileRow } from '../lib/ocr-drawings.api.js';
	import {
		bomStructureFromParams,
		ocrMarkRegionHash,
		ocrResultsHash,
		structureId
	} from '../lib/ocr-routes.js';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { ocrPushErrorToast } from '../lib/toast.js';

	let {
		params
	}: {
		params: {
			projectId: string;
			towerId?: string;
			stubId?: string;
			bomId: string;
			drawingSetName: string;
		};
	} = $props();

	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const drawingSet = $derived(decodeURIComponent(params.drawingSetName));
	const structure = $derived(bomStructureFromParams(params));
	const structureKey = $derived(structureId(structure));

	let files = $state<OcrDrawingFileRow[]>([]);
	let selectedRowKeys = $state<string[]>([]);
	let isLoading = $state(true);
	let generating = $state(false);

	const selectedFiles = $derived(files.filter((f) => selectedRowKeys.includes(f.fileId)));
	const selectedCount = $derived(selectedFiles.length);
	const selectedViewable = $derived(selectedFiles.filter((f) => f.hasResults));
	const canGenerate = $derived(Boolean(bomId && selectedCount > 0 && !generating));
	const canView = $derived(
		Boolean(
			selectedViewable.length > 0 &&
			selectedViewable.length === selectedCount &&
			!generating &&
			!isExtractionRunning(bomId)
		)
	);

	const columns = $derived.by((): DataTableColumn<OcrDrawingFileRow>[] => {
		void isExtractionRunning(bomId);

		return [
			{
				type: 'text',
				key: 'filename',
				header: 'Drawing file name',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => row.filename
			},
			{
				type: 'badge',
				key: 'status',
				header: 'Status',
				sortable: true,
				filterable: true,
				dataType: 'string',
				badge: (row): BadgeCell => drawingFileStatusBadge(row)
			},
			{
				type: 'text',
				key: 'createdAt',
				header: 'Uploaded at',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => (row.createdAt ? formatUtcAsIst(row.createdAt) : '—')
			}
		];
	});

	function onGenerate() {
		if (!canGenerate) return;
		const selected = selectedFiles;
		if (selected.length === 0) return;

		generating = true;
		const filenamesByFileId: Record<string, string> = {};
		for (const f of selected) filenamesByFileId[f.fileId] = f.filename;

		writeOcrGenerateSession({
			bomId,
			drawingFileIds: selected.map((f) => f.fileId),
			filenamesByFileId,
			projectId,
			structureKind: structure.kind,
			structureId: structureKey,
			drawingSet,
			sourceApp: 'ocr'
		});

		window.location.hash = ocrMarkRegionHash(projectId, structure, bomId);
		generating = false;
	}

	function onView() {
		if (!canView || selectedViewable.length === 0) return;
		const drawingFileIds = selectedViewable.map((f) => f.fileId);
		const filenamesByFileId: Record<string, string> = {};
		for (const f of selectedViewable) filenamesByFileId[f.fileId] = f.filename;

		writeOcrGenerateSession({
			bomId,
			drawingFileIds,
			filenamesByFileId,
			projectId,
			structureKind: structure.kind,
			structureId: structureKey,
			drawingSet,
			sourceApp: 'ocr'
		});
		window.location.hash = ocrResultsHash(projectId, structure, bomId);
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				files = await listOcrDrawingFiles(bomId, drawingSet, controller.signal);
				// Ready / Verified already have OCR — leave unchecked; user can still opt in.
				selectedRowKeys = files.filter((f) => !f.hasResults).map((f) => f.fileId);
			} catch (err) {
				files = [];
				selectedRowKeys = [];
				ocrPushErrorToast({
					title: 'Could not load drawings',
					description: errorDescription(err)
				});
			} finally {
				isLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<DataTable
		{columns}
		rows={files}
		loading={isLoading}
		rowKey={(row) => row.fileId}
		selection={{ enabled: true, mode: 'multiple' }}
		bind:selectedRowKeys
		search={{
			enabled: true,
			placeholder: 'Search drawing files...'
		}}
		toolbarButton={[
			{
				enabled: true,
				label: selectedViewable.length > 0 ? `View (${selectedViewable.length})` : 'View',
				variant: 'outline',
				disabled: !canView,
				onClick: onView
			},
			{
				enabled: true,
				label: generating
					? 'Opening…'
					: selectedCount > 0
						? `Generate (${selectedCount})`
						: 'Generate',
				variant: 'primary',
				disabled: !canGenerate,
				loading: generating,
				onClick: onGenerate
			}
		]}
		export={{ enabled: false }}
		emptyState={{
			icon: FileText,
			title: 'No drawings in this set',
			description: 'This drawing set has no files yet.'
		}}
		pagination={{ pageSize: 10 }}
	/>
</div>
