<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn, type TableAction } from '@ifactory/ui-v2';
	import { GitBranch } from '@lucide/svelte';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { bomPublishStatusBadge } from '../../project-management-app/lib/projects/bom-status-badges.js';
	import { canStartCuttingPlan } from '../../project-management-app/lib/bom-extract-status.js';
	import {
		cuttingPlanStatusBadge,
		isCuttingPlanReady
	} from '../../project-management-app/lib/bom-list-column-status.js';
	import { clearCuttingPlanDraft } from '../lib/cutting-plan/draft-cache.js';
	import { prepareReplanAllDraft } from '../lib/cutting-plan/replan-sections.js';
	import { hasSectionRules } from '../lib/cutting-plan/cp.api.js';
	import { cuttingPlanResultsVersion } from '../lib/cutting-plan/cutting-plan-results.svelte.js';
	import {
		cuttingPlanRunningVersion,
		isCuttingPlanRunning
	} from '../lib/cutting-plan/cutting-plan-running.svelte.js';
	import { getPublishedCpRunIdFromBom } from '../../project-management-app/lib/projects/boms.api.js';
	import {
		loadStubBomVersionsPageData,
		loadTowerBomVersionsPageData
	} from '../../project-management-app/lib/projects/load-bom-versions.js';
	import type { BomConfig } from '../../project-management-app/lib/store.svelte.js';
	import { bomStructureFromParams, cpRunsHash, cpSectionsHash } from '../lib/cp-routes.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { cpPushErrorToast } from '../lib/toast.js';

	let {
		params
	}: {
		params: { projectId: string; towerId?: string; stubId?: string; lineageId: string };
	} = $props();

	const projectId = $derived(params.projectId);
	const lineageId = $derived(decodeURIComponent(params.lineageId));
	const structure = $derived(bomStructureFromParams(params));

	let versions = $state<BomConfig[]>([]);
	let hasSectionRulesFlag = $state(false);
	let isLoading = $state(true);

	const BOM_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border-0 px-2 py-0 text-xs font-bold text-white font-['Space_Grotesk']";
	const OUTLINE_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border border-primary bg-background px-2 py-0 text-xs font-bold text-primary hover:bg-primary/10 font-['Space_Grotesk']";

	async function handlePlan(row: BomConfig) {
		await clearCuttingPlanDraft(row.id);
		window.location.hash = cpSectionsHash(projectId, structure, row.id);
	}

	async function handleReplan(row: BomConfig) {
		try {
			await prepareReplanAllDraft(row.id);
			window.location.hash = cpSectionsHash(projectId, structure, row.id);
		} catch (error) {
			cpPushErrorToast({
				title: 'Could not start replan',
				description: errorDescription(error)
			});
		}
	}

	function handleView(row: BomConfig) {
		window.location.hash = cpRunsHash(projectId, structure, row.id);
	}

	function cuttingPlanColumnActions(row: BomConfig): TableAction<BomConfig>[] {
		void cuttingPlanRunningVersion();
		void cuttingPlanResultsVersion();

		const isPlanned = isCuttingPlanReady(row);
		const isPublished = Boolean(getPublishedCpRunIdFromBom(row));
		const isRunning = isCuttingPlanRunning(row.id);
		const canPlan = canStartCuttingPlan(row, hasSectionRulesFlag);
		const statusBadge = cuttingPlanStatusBadge(row, hasSectionRulesFlag);
		const viewAction: TableAction<BomConfig> = {
			type: 'button',
			label: 'View',
			variant: 'outline',
			size: 'sm',
			class: OUTLINE_COL_BTN,
			disabled: isRunning || !isPlanned,
			onClick: () => handleView(row)
		};

		if (isRunning) {
			return [
				statusBadge,
				{
					type: 'button',
					label: isPlanned ? 'Replan' : 'Plan',
					variant: isPlanned ? 'outline' : 'primary',
					size: 'sm',
					class: isPlanned ? OUTLINE_COL_BTN : BOM_COL_BTN,
					disabled: true,
					onClick: () => {}
				},
				viewAction
			];
		}

		const primaryAction: TableAction<BomConfig> = isPlanned
			? {
					type: 'button',
					label: 'Replan',
					variant: 'outline',
					size: 'sm',
					class: OUTLINE_COL_BTN,
					disabled: isPublished || !canPlan,
					onClick: () => void handleReplan(row)
				}
			: {
					type: 'button',
					label: 'Plan',
					variant: 'primary',
					size: 'sm',
					class: BOM_COL_BTN,
					disabled: !canPlan,
					onClick: () => void handlePlan(row)
				};

		return [statusBadge, primaryAction, viewAction];
	}

	const columns = $derived.by((): DataTableColumn<BomConfig>[] => {
		void cuttingPlanRunningVersion();
		void cuttingPlanResultsVersion();
		return [
			{
				type: 'serial',
				key: 'sNo',
				header: 'S.No',
				value: (row) => String(versions.indexOf(row) + 1)
			},
			{
				type: 'text',
				key: 'version',
				header: 'Version',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => `V${row.version}`
			},
			{
				type: 'badge',
				key: 'stage',
				header: 'Status',
				sortable: true,
				filterable: true,
				dataType: 'string',
				badge: (row) => bomPublishStatusBadge(row)
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
				key: 'cuttingPlan',
				header: 'Cutting Plan',
				align: 'start',
				actions: cuttingPlanColumnActions
			}
		];
	});

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const [page, sectionRulesExist] = await Promise.all([
					structure.kind === 'tower'
						? loadTowerBomVersionsPageData(
								projectId,
								structure.towerId,
								lineageId,
								controller.signal
							)
						: loadStubBomVersionsPageData(
								projectId,
								structure.stubId,
								lineageId,
								controller.signal
							),
					hasSectionRules(projectId, controller.signal)
				]);
				versions = page.versions;
				hasSectionRulesFlag = sectionRulesExist;
			} catch (err) {
				versions = [];
				hasSectionRulesFlag = false;
				cpPushErrorToast({
					title: 'Could not load versions',
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
		rows={versions}
		loading={isLoading}
		rowKey={(row) => row.id}
		search={{ enabled: true, placeholder: 'Search versions...' }}
		export={{ enabled: false }}
		emptyState={{
			icon: GitBranch,
			title: 'No versions',
			description: 'This subtype has no BOM versions yet.'
		}}
		pagination={{ pageSize: 15 }}
	/>
</div>
