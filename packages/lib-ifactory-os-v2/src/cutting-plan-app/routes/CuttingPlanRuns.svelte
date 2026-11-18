<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		Badge,
		Button,
		ConfirmationDialog,
		DataTable,
		type DataTableColumn
	} from '@ifactory/ui-v2';
	import { AlertCircle, Plus } from '@lucide/svelte';
	import { formatPlanNumber } from '../lib/cutting-plan/planner-results';
	import {
		formatAlreadyPublishedCpMessage,
		formatPublishedCpBanner,
		getPublishedCpRun,
		loadCpRunsPublishEligibility,
		publishCpRun
	} from '../lib/cutting-plan/cp-publish.api.js';
	import {
		cuttingPlanRunHash,
		formatPlanRunTimestamp,
		formatPlanRunType,
		listPlanRuns,
		type CuttingPlanRun
	} from '../lib/cutting-plan/plan-runs';
	import {
		bomSectionsHash,
		bomStructureFromParams
	} from '../../project-management-app/lib/bom-structure-routes.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { cpPushErrorToast, cpPushSuccessToast, cpPushToast } from '../lib/toast.js';
	import type { CpPlanRunRow } from '../lib/cutting-plan/cp.rows.js';

	type RunTableRow = {
		id: string;
		sNo: number;
		versionLabel: string;
		createdAtLabel: string;
		ranBy: string;
		publishedAtLabel: string;
		publishedBy: string;
		typeLabel: string;
		sectionsCount: number;
		bars: number;
		wastePct: string;
		isPublished: boolean;
		canPublish: boolean;
		publishedColumnLabel: string;
		publishDisabledReason: string;
	};

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const structure = $derived(bomStructureFromParams(params));

	let isLoading = $state(true);
	let isPublishing = $state(false);
	let runs = $state<CuttingPlanRun[]>([]);
	let publishedRunId = $state<string | null>(null);
	let publishedVersion = $state<number | null>(null);
	const publishEligibility = new SvelteMap<
		string,
		{ canPublish: boolean; reason?: string; missingSections?: string[] }
	>();
	let publishConfirmOpen = $state(false);
	let pendingPublishRun = $state<CuttingPlanRun | null>(null);

	const tableRows = $derived.by((): RunTableRow[] =>
		runs.map((run, index) => {
			const eligibility = publishEligibility.get(run.id);
			const isPublished =
				run.status === 'published' || Boolean(run.publishedAt) || publishedRunId === run.id;
			const canPublish = Boolean(eligibility?.canPublish) && !isPublished && !publishedRunId;
			const hasMissingSections = (eligibility?.missingSections?.length ?? 0) > 0;
			return {
				id: run.id,
				sNo: index + 1,
				versionLabel: `v${run.version}`,
				createdAtLabel: formatPlanRunTimestamp(run.createdAt),
				ranBy: run.ranBy || '-',
				publishedAtLabel: run.publishedAt ? formatPlanRunTimestamp(run.publishedAt) : '-',
				publishedBy: run.publishedBy || '-',
				typeLabel: formatPlanRunType(run.type),
				sectionsCount: run.response.result?.total_sections ?? run.sectionsPlanned.length,
				bars: run.response.result?.total_bars ?? 0,
				wastePct:
					run.response.result?.waste_pct_weight != null
						? formatPlanNumber(run.response.result.waste_pct_weight, 2)
						: '-',
				isPublished,
				canPublish,
				publishedColumnLabel: isPublished
					? 'Published'
					: !publishedRunId && hasMissingSections
						? 'Few sections are missing'
						: '',
				publishDisabledReason: isPublished
					? 'Already published'
					: publishedRunId
						? formatAlreadyPublishedCpMessage(publishedVersion)
						: hasMissingSections
							? 'Few sections are missing'
							: (eligibility?.reason ?? 'Checking eligibility…')
			};
		})
	);

	const publishConfirmDescription = $derived.by(() => {
		if (!pendingPublishRun) return '';
		return `Publishing v${pendingPublishRun.version} will be used for all future production plans for this BOM.`;
	});

	async function refreshPublishState(signal?: AbortSignal) {
		// Prefer published marker from the list we already loaded; fall back to one status=published GET.
		const fromList = runs.find((run) => run.status === 'published');
		if (fromList) {
			publishedRunId = fromList.id;
			publishedVersion = fromList.version;
		} else {
			const published = await getPublishedCpRun(bomId, signal);
			publishedRunId = published?.runId ?? null;
			publishedVersion = published?.version ?? null;
		}

		publishEligibility.clear();
		const runRows: CpPlanRunRow[] = runs.map((run) => ({
			run_id: run.id,
			bom_id: bomId,
			version: run.version,
			run_type: run.type,
			status: run.status,
			section_plan_ids: run.sectionPlanIds,
			sections_planned: run.sectionsPlanned
		}));
		const eligibilityByRun = await loadCpRunsPublishEligibility(bomId, runRows, signal);
		for (const [runId, result] of eligibilityByRun) {
			publishEligibility.set(runId, {
				canPublish: result.canPublish,
				reason: result.reason,
				missingSections: result.missingSections
			});
		}
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				runs = await listPlanRuns(bomId);
				await refreshPublishState(controller.signal);
			} catch (error) {
				if (controller.signal.aborted) return;
				cpPushToast({
					title: 'Failed to load plan runs',
					description: formatApiErrorMessage(error)
				});
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		return () => controller.abort();
	});

	function openSummary(runId: string) {
		window.location.hash = cuttingPlanRunHash(projectId, structure, bomId, runId, 'Summary');
	}

	function openBarDetails(runId: string) {
		window.location.hash = cuttingPlanRunHash(projectId, structure, bomId, runId, 'Plan');
	}

	function handleStartPlan() {
		window.location.hash = bomSectionsHash(projectId, structure, bomId);
	}

	function openPublishDialog(run: CuttingPlanRun) {
		pendingPublishRun = run;
		publishConfirmOpen = true;
	}

	async function handlePublishConfirm() {
		if (!pendingPublishRun || isPublishing) return;
		isPublishing = true;
		try {
			await publishCpRun(bomId, {
				run_id: pendingPublishRun.id,
				version: pendingPublishRun.version
			});
			publishedRunId = pendingPublishRun.id;
			publishedVersion = pendingPublishRun.version;
			publishConfirmOpen = false;
			pendingPublishRun = null;
			cpPushSuccessToast({
				title: 'Cutting plan published',
				description: `v${publishedVersion} will be used when adding the BOM to production plans.`
			});
			runs = await listPlanRuns(bomId);
			await refreshPublishState();
		} catch (error) {
			cpPushErrorToast({
				title: 'Could not publish run',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isPublishing = false;
		}
	}

	const columns: DataTableColumn<RunTableRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sticky: true,
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.sNo)
		},
		{
			key: 'versionLabel',
			header: 'Version',
			sticky: true,
			sortable: true,
			filterable: false,
			dataType: 'string',
			value: (row) => row.versionLabel
		},
		{
			key: 'published',
			header: 'Published',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: (row) => row.publishedColumnLabel
		},
		{
			key: 'createdAtLabel',
			header: 'Run at',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.createdAtLabel
		},
		{
			key: 'ranBy',
			header: 'Run by',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.ranBy
		},
		{
			key: 'publishedAtLabel',
			header: 'Published at',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.publishedAtLabel
		},
		{
			key: 'publishedBy',
			header: 'Published by',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.publishedBy
		},
		{
			key: 'typeLabel',
			header: 'Type',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.typeLabel
		},
		{
			key: 'sectionsCount',
			header: 'Sections',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.sectionsCount)
		},
		{
			key: 'bars',
			header: 'Bars',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.bars)
		},
		{
			key: 'wastePct',
			header: 'Waste %',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.wastePct
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			align: 'end',
			actions: (row) => {
				const actions = [
					{
						type: 'button' as const,
						label: 'Summary',
						variant: 'outline' as const,
						size: 'sm' as const,
						onClick: () => openSummary(row.id)
					},
					{
						type: 'button' as const,
						label: 'RM Required',
						variant: 'outline' as const,
						size: 'sm' as const,
						onClick: () => openBarDetails(row.id)
					}
				];
				if (row.isPublished) {
					actions.unshift({
						type: 'button' as const,
						label: 'Published',
						variant: 'outline' as const,
						size: 'sm' as const,
						disabled: true,
						onClick: () => {}
					});
				} else {
					actions.unshift({
						type: 'button' as const,
						label: 'Publish',
						variant: 'primary' as const,
						size: 'sm' as const,
						disabled: !row.canPublish || isPublishing,
						title: row.canPublish ? undefined : row.publishDisabledReason,
						onClick: () => {
							const run = runs.find((item) => item.id === row.id);
							if (run) openPublishDialog(run);
						}
					});
				}
				return actions;
			}
		}
	];
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	{#if isLoading || tableRows.length > 0}
		{#if !isLoading && publishedRunId}
			<div class="mb-4">
				<Badge variant="default" label={formatPublishedCpBanner(publishedVersion)} dot={false} />
			</div>
		{/if}
		<DataTable
			class="min-h-0 flex-1"
			{columns}
			rows={tableRows}
			loading={isLoading}
			rowKey={(row) => row.id}
			pagination={{ enabled: true }}
			search={{
				enabled: true,
				placeholder: 'Search runs...'
			}}
			toolbarButton={{
				enabled: true,
				label: 'New plan',
				icon: Plus,
				onClick: handleStartPlan
			}}
			export={{ enabled: false }}
			tableClass="rounded-none"
		/>
	{:else}
		<div class="flex flex-1 flex-col items-center justify-center py-16 text-center">
			<AlertCircle class="mb-3 h-8 w-8 text-muted-foreground" />
			<h3 class="text-lg font-medium text-foreground">No plan runs yet</h3>
			<p class="mt-1 max-w-md text-muted-foreground">
				Start a cutting plan from the BOM list to create the first run.
			</p>
			<Button
				variant="outline"
				class="mt-4 rounded-none"
				onclick={handleStartPlan}
				label="Start plan"
			/>
		</div>
	{/if}
</div>

<ConfirmationDialog
	open={publishConfirmOpen}
	title="Publish cutting plan version?"
	description={publishConfirmDescription}
	confirmLabel={isPublishing ? 'Publishing…' : 'Publish'}
	cancelLabel="Cancel"
	confirmDisabled={isPublishing}
	onConfirm={handlePublishConfirm}
	onCancel={() => {
		if (isPublishing) return;
		publishConfirmOpen = false;
		pendingPublishRun = null;
	}}
/>
