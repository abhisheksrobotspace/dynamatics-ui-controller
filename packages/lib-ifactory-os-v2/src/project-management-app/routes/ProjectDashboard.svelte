<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ProgressBar,
		KpiCardStrip,
		type KpiCardItem,
		type ProgressBarColorConfig,
		type ProgressBarStep
	} from '@ifactory/ui-v2';
	import { ClipboardList, FileText, HardHat, Hash, List, Route, FolderOpen } from '@lucide/svelte';
	import { loadProjectDashboardData } from '../lib/projects/load-project-dashboard.js';
	import PageSkeleton from '../components/PageSkeleton.svelte';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import { errorDescription } from '../../lib/api/types.js';
	import type { Project } from '../lib/store.svelte';

	let { params } = $props();
	const projectId = $derived(params.projectId);

	/** When false, the Operations Count Configuration step is hidden from the dashboard. */
	const OPERATIONS_COUNT_CONFIGURATION_ENABLED = true;
	/** When false, the QRC step is hidden from the dashboard. */
	const RELEASES_ENABLED = true;
	/** When false, the Production Plan step is hidden from the dashboard. */
	const PRODUCTION_PLAN_ENABLED = false;

	let project = $state<Project | null>(null);
	let isLoading = $state(true);
	let loadError = $state('');

	function navigateTo(path: string) {
		window.location.hash = path;
	}

	// function truncateText(value: string, maxLength = 15): string {
	// 	if (value.length <= maxLength) return value;
	// 	return `${value.slice(0, maxLength)}…`;
	// }

	function displayValue(value: string | undefined | null): { value: string; valueTitle?: string } {
		const full = value?.trim() || '-';
		if (full === '-') return { value: full };
		return {
			value: full,
			valueTitle: full.length > 15 ? full : undefined
		};
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const data = await loadProjectDashboardData(projectId, controller.signal);
				project = data.project;
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				loadError = errorDescription(error);
				project = null;
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		return () => controller.abort();
	});

	const projectSteps = $derived.by((): ProgressBarStep[] => {
		function projectStep(label: string, value: string, route: string): ProgressBarStep {
			const go = () => navigateTo(`#/ProjectManagement/Home/${projectId}/${route}`);
			return {
				label,
				value,
				buttonLabel: 'Configure',
				onclick: go,
				onButtonClick: go,
				/** Force in-progress styling on every step (same as Create Tower Types). */
				status: 'current'
			};
		}

		return [
			projectStep('Towers', 'towers', 'Towers'),
			projectStep('Stubs', 'stubs', 'Stubs'),
			projectStep('Cutting Plan', 'cutting', 'CuttingPlanConfiguration'),
			...(OPERATIONS_COUNT_CONFIGURATION_ENABLED
				? [projectStep('Operations Count', 'operations-count', 'OperationsCountConfiguration')]
				: []),
			...(RELEASES_ENABLED
				? [
						projectStep('Quantity Requirement Sheet', 'qrc', 'Qrc'),
						projectStep('Delivery Schedule', 'delivery-schedule', 'DeliverySchedule')
					]
				: []),
			...(PRODUCTION_PLAN_ENABLED
				? [projectStep('Production Plan', 'production-plan', 'ProductionPlanQrc')]
				: [])
		];
	});

	const progressColors: ProgressBarColorConfig = {
		tone: 'neutral',
		complete: 'neutral',
		current: 'neutral',
		upcoming: 'neutral'
	};

	const primaryInfoCards = $derived.by((): KpiCardItem[] => {
		if (!project) return [];
		return [
			{
				label: 'Name',
				icon: FolderOpen,
				...displayValue(project.projectName)
			},
			{
				label: 'Work Order No',
				icon: ClipboardList,
				...displayValue(project.workOrderNo)
			},
			{
				label: 'Contractor',
				icon: HardHat,
				...displayValue(project.contractorName)
			},
			{
				label: 'Customer',
				icon: List,
				...displayValue(project.customerName)
			}
		];
	});

	const detailInfoCards = $derived.by((): KpiCardItem[] => {
		if (!project) return [];
		return [
			{
				label: 'Project Details',
				icon: FileText,
				...displayValue(project.projectDetails)
			},
			{
				label: 'Line Details',
				icon: Route,
				...displayValue(project.lineDetails)
			},
			{
				label: 'LOA No.',
				icon: Hash,
				...displayValue(project.loaNo)
			}
		];
	});
</script>

{#if isLoading}
	<PageSkeleton variant="dashboard" />
{:else if loadError}
	<div class="p-4">
		<ApiErrorBanner title="Could not load project" description={loadError} />
	</div>
{:else if project}
	<div class="flex flex-col gap-4 p-4">
		<div class="border border-border bg-white">
			<KpiCardStrip items={primaryInfoCards} columns={4} class="border-0" />
			<KpiCardStrip items={detailInfoCards} columns={3} class="border-0 border-t border-border" />
		</div>

		<ProgressBar
			class="w-full"
			items={projectSteps}
			value="towers"
			variant="panels"
			align="vertical"
			showButton
			buttonPlacement="beside"
			buttonLabel="Configure"
			buttonVariant="primary"
			showStepIndicator={false}
			colors={progressColors}
			interactive
			advanceOnButtonClick={false}
			ariaLabel="Project workflow"
		/>
	</div>
{:else}
	<p class="px-4 text-gray-500">Project not found.</p>
{/if}
