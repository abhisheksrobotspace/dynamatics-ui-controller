<script lang="ts">
	import { onMount } from 'svelte';
	import {
		bindBomExtractHandlers,
		clearLiveExtractStatus,
		hydrateBomExtractStatuses,
		resumeBomExtractPolls,
		seedLiveExtractStatuses,
		stopBomExtractPoll,
		unbindBomExtractHandlers
	} from '../lib/bom-extract-poll.svelte';
	import { canStartCuttingPlan, isBomExtractReady } from '../lib/bom-extract-status';
	import {
		bomBomsListHash,
		bomSectionsHash,
		bomStructureFromParams,
		bomVersionDetailHash,
		cuttingPlanRunsHash,
		structureId
	} from '../lib/bom-structure-routes.js';
	import { hasSectionRules } from '../../cutting-plan-app/lib/cutting-plan/cp.api.js';
	import { clearCuttingPlanDraft } from '../../cutting-plan-app/lib/cutting-plan/draft-cache';
	import { openAppAtHash } from '$lib/os/index.svelte';
	import { APP as CUTTING_PLAN_APP } from '../../cutting-plan-app/lib/cutting-plan-app-routes.js';
	import { ocrBomDetailHash } from '../../ocr-app/lib/ocr-routes.js';
	import {
		Button,
		ConfirmationDialog,
		DataTable,
		Dialog,
		Input,
		Label,
		type DataTableColumn,
		type TableAction
	} from '@ifactory/ui-v2';
	import { pmPushErrorToast, pmPushSuccessToast, pmPushToast } from '../lib/toast';
	import { errorDescription, formatApiErrorMessage } from '../../lib/api/types.js';
	import { EllipsisVertical, Layers, Loader2, Plus, Trash2 } from '@lucide/svelte';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import type { BomConfig, StubType, TowerType } from '../lib/store.svelte';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { bomPublishStatusBadge } from '../lib/projects/bom-status-badges.js';
	import {
		BOM_CSV_FILE_ACCEPT,
		BOM_CSV_MULTIPLE_FILES_ERROR,
		readSingleBomCsvFromInput,
		validateBomCsvHeaders
	} from '../lib/projects/bom-csv-validation.js';
	import { queueBomExtraction } from '../lib/bom-extract-poll.svelte.js';
	import { filesUpload } from '../lib/core-api.js';
	import {
		createBomVersion,
		deleteBom,
		getMaxSortOrderForStructure,
		getPublishedCpRunIdFromBom,
		setBomFileId,
		setBomStage
	} from '../lib/projects/boms.api.js';
	import {
		loadStubBomVersionsPageData,
		loadTowerBomVersionsPageData,
		patchVersionInList,
		removeVersionFromList
	} from '../lib/projects/load-bom-versions.js';
	import { removeBomBreadcrumb, upsertBomBreadcrumb } from '../lib/projects/load-boms.js';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const structure = $derived(bomStructureFromParams(params));
	const structureKey = $derived(structureId(structure));
	const lineageId = $derived(params.lineageId);

	let structureEntity = $state<TowerType | StubType | null>(null);
	let versions = $state<BomConfig[]>([]);
	let maxSortOrder = $state<number | null>(null);

	let isLoading = $state(true);
	let loadError = $state('');
	let isPublishing = $state(false);
	let isCreatingVersion = $state(false);
	let isDeleting = $state(false);
	let isDeleteDialogOpen = $state(false);
	let isNewVersionDialogOpen = $state(false);
	let newVersionFormError = $state('');
	let newVersionBomFileInputKey = $state(0);
	let selectedNewVersionBomFile = $state<File | null>(null);
	let activeBom = $state<BomConfig | null>(null);
	let selectedRowKeys = $state<string[]>([]);

	const FILE_INPUT_CLASS =
		'cursor-pointer pt-1 file:mr-4 file:rounded-none file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-gray-700 hover:file:bg-gray-200';

	const BOM_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border-0 px-2 py-0 text-xs font-bold text-white font-['Space_Grotesk']";
	const OUTLINE_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border border-primary bg-background px-2 py-0 text-xs font-bold text-primary hover:bg-primary/10 font-['Space_Grotesk']";

	const lineageName = $derived(versions[0]?.bomName ?? '');
	const nextVersionNumber = $derived(
		versions.length > 0 ? Math.max(...versions.map((bom) => bom.version)) + 1 : 1
	);
	const selectedBom = $derived(versions.find((bom) => selectedRowKeys.includes(bom.id)) ?? null);
	const bomsListHref = $derived(bomBomsListHash(projectId, structure));

	function toStructureBom(bom: BomConfig): BomConfig {
		if (structure.kind === 'stub') {
			return { ...bom, towerId: undefined, stubId: structure.stubId };
		}
		return { ...bom, stubId: undefined, towerId: structure.towerId };
	}

	async function loadVersionsPageData(signal: AbortSignal) {
		if (structure.kind === 'tower') {
			return loadTowerBomVersionsPageData(projectId, structure.towerId, lineageId, signal);
		}
		return loadStubBomVersionsPageData(projectId, structure.stubId, lineageId, signal);
	}

	onMount(() => {
		const controller = new AbortController();

		bindBomExtractHandlers({
			getBom: (id) => versions.find((bom) => bom.id === id),
			updateBom: (next) => syncVersionRow(toStructureBom(next))
		});

		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const data = await loadVersionsPageData(controller.signal);
				structureEntity = data.entity;
				versions = data.versions;
				selectedRowKeys =
					data.versions.length > 0 ? [data.versions[data.versions.length - 1].id] : [];
				seedLiveExtractStatuses(data.versions);
				await hydrateBomExtractStatuses(data.versions);
				resumeBomExtractPolls(data.versions);
			} catch (error) {
				const message = errorMessage(error);
				if (message) loadError = message;
			} finally {
				isLoading = false;
			}
		})();

		return () => {
			controller.abort();
			unbindBomExtractHandlers();
		};
	});

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function syncVersionRow(bom: BomConfig) {
		const next = toStructureBom(bom);
		versions = patchVersionInList(versions, next);
		upsertBomBreadcrumb({
			id: next.id,
			towerId: next.towerId,
			stubId: next.stubId,
			bomName: next.bomName,
			bomLineageId: next.bomLineageId,
			version: next.version,
			bomFileId: next.bomFileId ?? null,
			bomFile: next.bomFile ?? null
		});
	}

	function handleView(bom: BomConfig) {
		window.location.hash = bomVersionDetailHash(projectId, structure, bom.id);
	}

	async function handleSetStage(bom: BomConfig, stage: 'proto' | 'mass') {
		if (bom.stage === stage || isPublishing) return;

		isPublishing = true;
		try {
			await setBomStage(bom.id, stage);
			syncVersionRow({ ...bom, stage });
			pmPushSuccessToast({
				title: stage === 'mass' ? 'Version published' : 'Version set to Proto'
			});
		} catch (error) {
			pmPushErrorToast({
				title: stage === 'mass' ? 'Could not publish version' : 'Could not set Proto',
				description: errorDescription(error)
			});
		} finally {
			isPublishing = false;
		}
	}

	function requireSelectedBom(actionLabel: string): BomConfig | null {
		if (selectedBom) return selectedBom;
		pmPushToast({
			title: 'Select a version',
			description: `Choose a version before ${actionLabel}.`
		});
		return null;
	}

	function goToBomsList() {
		window.location.hash = bomsListHref;
	}

	async function handleSendToCp() {
		const bom = requireSelectedBom('sending to Cutting Plan');
		if (!bom) return;

		if (getPublishedCpRunIdFromBom(bom)) {
			const { app } = await import('../../cutting-plan-app/app.svelte.ts');
			openAppAtHash(app, cuttingPlanRunsHash(projectId, structure, bom.id, CUTTING_PLAN_APP));
			return;
		}

		let sectionRulesExist: boolean;
		try {
			sectionRulesExist = await hasSectionRules(projectId);
		} catch (error) {
			pmPushErrorToast({
				title: 'Could not load section rules',
				description: errorDescription(error)
			});
			return;
		}

		if (!canStartCuttingPlan(bom, sectionRulesExist)) {
			if (!bom.bomFileId && !bom.bomFile) {
				pmPushToast({
					title: 'BOM CSV required',
					description: 'Upload a BOM CSV on this version before starting a cutting plan.'
				});
				return;
			}
			if (!isBomExtractReady(bom)) {
				pmPushToast({
					title: 'BOM extraction required',
					description: 'Wait for BOM extraction to finish before starting a cutting plan.'
				});
				return;
			}
			pmPushToast({
				title: 'Section rules required',
				description: 'Configure section rules for this project before starting a cutting plan.'
			});
			return;
		}

		await clearCuttingPlanDraft(bom.id);
		const { app } = await import('../../cutting-plan-app/app.svelte.ts');
		openAppAtHash(app, bomSectionsHash(projectId, structure, bom.id, CUTTING_PLAN_APP));
	}

	async function handleSendToOcr() {
		const bom = requireSelectedBom('sending to OCR');
		if (!bom) return;

		if (!bom.bomFileId && !bom.bomFile) {
			pmPushToast({
				title: 'BOM CSV required',
				description: 'Upload a BOM CSV on this version before starting OCR.'
			});
			return;
		}

		const { app } = await import('../../ocr-app/app.svelte.ts');
		openAppAtHash(app, ocrBomDetailHash(projectId, structure, bom.id));
	}

	function openNewVersionDialog() {
		if (isCreatingVersion || versions.length === 0) return;
		newVersionFormError = '';
		selectedNewVersionBomFile = null;
		newVersionBomFileInputKey += 1;
		isNewVersionDialogOpen = true;
	}

	function closeNewVersionDialog() {
		isNewVersionDialogOpen = false;
		newVersionFormError = '';
		selectedNewVersionBomFile = null;
		newVersionBomFileInputKey += 1;
	}

	function isCsvFile(name: string): boolean {
		return name.toLowerCase().endsWith('.csv');
	}

	async function handleNewVersionBomFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const picked = readSingleBomCsvFromInput(target);
		if (!picked.ok) {
			if (picked.reason === 'multiple') {
				newVersionFormError = BOM_CSV_MULTIPLE_FILES_ERROR;
				newVersionBomFileInputKey += 1;
			} else {
				selectedNewVersionBomFile = null;
			}
			return;
		}

		const file = picked.file;
		newVersionFormError = '';
		if (!isCsvFile(file.name)) {
			newVersionFormError = 'BOM file must be a .csv file.';
			selectedNewVersionBomFile = null;
			newVersionBomFileInputKey += 1;
			return;
		}

		const validation = await validateBomCsvHeaders(file);
		if (!validation.valid) {
			newVersionFormError = `Invalid BOM CSV headers. Missing columns: ${validation.missingColumns.join(', ')}`;
			selectedNewVersionBomFile = null;
			newVersionBomFileInputKey += 1;
			return;
		}

		selectedNewVersionBomFile = file;
	}

	async function handleNewVersionConfirm() {
		if (isCreatingVersion) return;

		if (!selectedNewVersionBomFile) {
			newVersionFormError = 'BOM file is required.';
			return;
		}

		const template = versions[versions.length - 1] ?? versions[0];
		if (!template) {
			pmPushToast({
				title: 'Cannot create version',
				description: 'No existing version found for this subtype lineage.'
			});
			return;
		}

		isCreatingVersion = true;
		newVersionFormError = '';

		try {
			const bomFile = selectedNewVersionBomFile;
			const resolvedMaxSortOrder =
				maxSortOrder ?? (await getMaxSortOrderForStructure(structureKey));
			const nextSNo = resolvedMaxSortOrder + 1;

			const created = await createBomVersion({
				towerId: structureKey,
				bomName: template.bomName,
				bomLineageId: lineageId,
				version: nextVersionNumber,
				stage: 'proto',
				nextSNo
			});

			const bomFileId = await filesUpload(bomFile, bomFile.name, 'proj_boms', created.id);
			await setBomFileId(created.id, bomFileId, { bom_file_name: bomFile.name }, bomFile.name);

			const mapped = toStructureBom({
				...created,
				bomFileId,
				bomFile: bomFile.name,
				extractStatus: 'pending'
			});
			maxSortOrder = nextSNo;
			selectedRowKeys = [mapped.id];
			syncVersionRow(mapped);
			await queueBomExtraction(projectId, structureKey, mapped, bomFileId);

			closeNewVersionDialog();
			pmPushSuccessToast({ title: `Version V${mapped.version} created` });
		} catch (error) {
			newVersionFormError = errorMessage(error);
		} finally {
			isCreatingVersion = false;
		}
	}

	function openDeleteDialog(bom: BomConfig) {
		activeBom = bom;
		isDeleteDialogOpen = true;
	}

	async function handleDeleteConfirm() {
		if (!activeBom || isDeleting) return;

		const deletedVersion = activeBom.version;
		const deletedId = activeBom.id;
		isDeleting = true;
		try {
			await deleteBom(deletedId);
			stopBomExtractPoll(deletedId);
			clearLiveExtractStatus(deletedId);
			removeBomBreadcrumb(deletedId);

			versions = removeVersionFromList(versions, deletedId);
			if (selectedRowKeys.includes(deletedId)) {
				selectedRowKeys = versions.length > 0 ? [versions[versions.length - 1].id] : [];
			}

			activeBom = null;
			pmPushSuccessToast({ title: `Version V${deletedVersion} deleted` });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete version',
					description: message
				});
			}
			throw error;
		} finally {
			isDeleting = false;
		}
	}

	function versionActions(row: BomConfig): TableAction<BomConfig>[] {
		const isPublished = row.stage === 'mass';
		return [
			{
				type: 'button',
				label: 'View',
				variant: 'primary',
				size: 'sm',
				class: BOM_COL_BTN,
				onClick: () => handleView(row)
			},
			{
				type: 'button',
				label: isPublished ? 'Proto' : 'Publish',
				variant: 'outline',
				size: 'sm',
				class: OUTLINE_COL_BTN,
				disabled: isPublishing,
				onClick: () => handleSetStage(row, isPublished ? 'proto' : 'mass')
			},
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
							onClick: (selectedRow) => openDeleteDialog(selectedRow)
						}
					]
				]
			}
		];
	}

	const columns = $derived.by((): DataTableColumn<BomConfig>[] => {
		void isPublishing;
		return [
			{
				type: 'serial',
				key: 'sNo',
				header: 'S.No',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: (row) => String(versions.findIndex((v) => v.id === row.id) + 1)
			},
			{
				type: 'text',
				key: 'version',
				header: 'Version',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: (row) => `V${row.version}`
			},
			{
				type: 'badge',
				key: 'stage',
				header: 'Status',
				sortable: true,
				filterable: true,
				dataType: 'string',
				badge: bomPublishStatusBadge
			},
			{
				type: 'text',
				key: 'createdAt',
				header: 'Created At',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => (row.createdAt ? formatUtcAsIst(row.createdAt) : '—')
			},
			{
				type: 'actions',
				key: 'actions',
				header: 'Actions',
				headerClass: 'text-right',
				class: 'text-right',
				actions: versionActions
			}
		];
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	{#if showPageTopLoadErrors && loadError}
		<div class="mb-4">
			<ApiErrorBanner message={loadError} />
		</div>
	{/if}

	{#if isLoading || structureEntity}
		{#if !isLoading && versions.length === 0}
			<div class="flex flex-col items-start gap-3 py-8">
				<p class="text-sm text-muted-foreground">
					No versions found for this subtype lineage.
					{#if lineageName}
						({lineageName})
					{/if}
				</p>
				<Button variant="outline" label="Back to Subtypes" onclick={goToBomsList} />
			</div>
		{:else}
			<DataTable
				{columns}
				rows={versions}
				loading={isLoading}
				rowKey={(row) => row.id}
				onRowClick={handleView}
				selection={{ enabled: true, mode: 'single' }}
				bind:selectedRowKeys
				search={{
					enabled: true,
					placeholder: 'Search versions...'
				}}
				toolbarButton={[
					{
						enabled: isLoading || versions.length > 0,
						disabled: !selectedBom || isCreatingVersion,
						label: 'Send to CP',
						variant: 'outline',
						onClick: () => void handleSendToCp()
					},
					{
						enabled: isLoading || versions.length > 0,
						disabled: !selectedBom || isCreatingVersion,
						label: 'Send to OCR',
						variant: 'outline',
						onClick: () => void handleSendToOcr()
					},
					{
						enabled: isLoading || versions.length > 0,
						disabled: isCreatingVersion || versions.length === 0,
						loading: isCreatingVersion,
						label: 'New version',
						icon: Plus,
						variant: 'primary',
						onClick: openNewVersionDialog
					}
				]}
				emptyState={{
					icon: Layers,
					title: 'No versions',
					description: lineageName
						? `No versions configured for ${lineageName}.`
						: 'No versions configured for this subtype.',
					actionLabel: 'Back to BOMs',
					onAction: goToBomsList
				}}
				pagination={{ pageSize: 10 }}
			/>
		{/if}
	{:else}
		<div class="flex flex-col items-start gap-3 py-8">
			<p class="text-sm text-muted-foreground">Tower not found.</p>
			<Button variant="outline" label="Back to BOMs" onclick={goToBomsList} />
		</div>
	{/if}
</div>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete version"
	description={activeBom
		? `Are you sure you want to delete version V${activeBom.version}?`
		: 'Are you sure you want to delete this version?'}
	confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>

<Dialog
	bind:open={isNewVersionDialogOpen}
	title="New version"
	hideFooter={true}
	closeOnBackdrop={!isCreatingVersion}
	showCloseButton={!isCreatingVersion}
	onConfirm={handleNewVersionConfirm}
>
	<div class="relative">
		{#if isCreatingVersion}
			<div
				class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/85"
				role="status"
				aria-live="polite"
				aria-busy="true"
			>
				<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">Creating version…</p>
			</div>
		{/if}
		<div class="space-y-4">
			{#if newVersionFormError}
				<ApiErrorBanner message={newVersionFormError} />
			{/if}
			<div class="space-y-2">
				<Label for="new-version-number" text="Version" />
				<Input id="new-version-number" value={`V${nextVersionNumber}`} disabled />
			</div>
			<div class="space-y-2">
				<Label for="new-version-bom-file" text="BOM File" required />
				{#key newVersionBomFileInputKey}
					<Input
						id="new-version-bom-file"
						type="file"
						accept={BOM_CSV_FILE_ACCEPT}
						multiple={false}
						disabled={isCreatingVersion}
						class={FILE_INPUT_CLASS}
						onchange={handleNewVersionBomFileChange}
					/>
				{/key}
			</div>
		</div>

		<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-gray-200 pt-6">
			<Button
				variant="outline"
				label="Cancel"
				disabled={isCreatingVersion}
				onclick={closeNewVersionDialog}
			/>
			<Button
				variant="primary"
				label={isCreatingVersion ? 'Creating...' : 'Create version'}
				disabled={isCreatingVersion}
				loading={isCreatingVersion}
				onclick={() => void handleNewVersionConfirm()}
				class="min-w-28"
			/>
		</div>
	</div>
</Dialog>
