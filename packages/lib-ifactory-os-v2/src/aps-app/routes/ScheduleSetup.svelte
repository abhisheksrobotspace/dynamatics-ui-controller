<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		Alert,
		Badge,
		Button,
		Skeleton,
		TreeTable,
		type TreeTableColumn,
		type TreeTableNode
	} from '@ifactory/ui-v2';
	import AppBusyOverlay from '../../lib/appShell/AppBusyOverlay.svelte';
	import { APP_INSTANCE_ID_CONTEXT } from '../../lib/appShell/appSharedState.js';
	import { isOsAppInstanceFocused } from '../../lib/os/app-focus.svelte.js';
	import { ArrowLeft, History, Package, Play } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { formatWeightMtCell } from '../lib/create-plan-ds.utils.js';
	import { DEFAULT_APS_SOLVER } from '../lib/aps-scheduler.js';
	import {
		startApsScheduleRun,
		type ApsScheduleRunHandle
	} from '../lib/aps-schedule-background.js';
	import { isPlanScheduleActive } from '../lib/production-schedule.api.js';
	import { watchActiveScheduleRun } from '../lib/active-schedule-run-poll.js';
	import { productionScheduleHash } from '../lib/production-schedule.types.js';
	import { scheduleRunsHash } from '../lib/schedule-runs.js';
	import { loadScheduleSetupDetail, type ScheduleSetupDetail } from '../lib/schedule-setup.api.js';
	import { rememberManufacturingPlanLabel } from '../lib/manufacturing-plans.js';
	import { apsPushErrorToast, apsPushSuccessToast, apsPushToast } from '../lib/toast.js';
	import {
		buildScheduleSetupTree,
		scheduleSetupTreeFilterMatch,
		type ScheduleSetupTreeRowData
	} from '../lib/schedule-setup.tree.js';

	let { params } = $props();

	const planId = $derived(String(params.planId ?? ''));
	const appInstanceId = getContext<string>(APP_INSTANCE_ID_CONTEXT);

	let loading = $state(true);
	let scheduling = $state(false);
	let remoteScheduling = $state(false);
	let errorMessage = $state<string | null>(null);
	let notFound = $state(false);
	let detail = $state<ScheduleSetupDetail | null>(null);
	let expandedIds = $state<string[]>([]);
	let knownProjectIds = $state<Set<string>>(new Set());
	let activeScheduleRun = $state.raw<ApsScheduleRunHandle | null>(null);

	const isScheduling = $derived(scheduling || remoteScheduling);
	const runScheduleLabel = $derived(isScheduling ? 'Running…' : 'Run Schedule');
	const canRunSchedule = $derived(detail !== null && detail.boms.length > 0 && !isScheduling);
	const treeNodes = $derived(buildScheduleSetupTree(detail?.boms ?? []));
	const showRunInBackground = $derived(Boolean(scheduling && activeScheduleRun));

	$effect(() => {
		const projectIds = treeNodes.map((node) => node.id);
		const newProjectIds = projectIds.filter((id) => !knownProjectIds.has(id));
		if (newProjectIds.length === 0) return;
		expandedIds = [...new Set([...expandedIds, ...newProjectIds])];
		knownProjectIds = new Set([...knownProjectIds, ...newProjectIds]);
	});

	const columns = $derived.by((): TreeTableColumn<ScheduleSetupTreeRowData>[] => [
		{
			key: 'description',
			header: 'Description',
			tree: true,
			class: 'min-w-[16rem] text-sm',
			value: (node) => node.label
		},
		{
			key: 'qty',
			header: 'Qty',
			headerClass: 'text-right',
			class: 'text-right text-sm',
			value: (node) => node.data?.qty ?? ''
		},
		{
			key: 'weight',
			header: 'Weight (MT)',
			headerClass: 'text-right',
			class: 'text-right text-sm',
			value: (node) => formatWeightMtCell(node.data?.weightMt)
		}
	]);

	function treeRowClass(node: TreeTableNode<ScheduleSetupTreeRowData>): string {
		if (node.data?.level === 'bom') return 'bg-surface text-sm font-normal';
		return 'text-sm';
	}

	function navigateToPlans() {
		window.location.hash = '#/ShopFloorPlanning/ApsRuns';
	}

	function navigateToRuns() {
		window.location.hash = scheduleRunsHash(planId);
	}

	async function refreshDetail(signal?: AbortSignal) {
		const next = await loadScheduleSetupDetail(planId, signal);
		if (!next) {
			notFound = true;
			detail = null;
			return;
		}
		notFound = false;
		detail = next;
		rememberManufacturingPlanLabel(next.planId, next.planName);
	}

	async function runSchedule() {
		if (!planId || notFound || isScheduling) return;
		try {
			const active = await isPlanScheduleActive(planId);
			if (active) {
				remoteScheduling = true;
				return;
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
			apsPushErrorToast({
				title: 'Could not run schedule',
				description: errorMessage
			});
			return;
		}

		scheduling = true;
		errorMessage = null;
		const handle = startApsScheduleRun({
			planId,
			kind: 'schedule',
			solver: DEFAULT_APS_SOLVER
		});
		activeScheduleRun = handle;
		try {
			await handle.promise;
			if (handle.detached) return;
			apsPushSuccessToast({ title: 'Schedule completed' });
			window.location.hash = productionScheduleHash(planId);
		} catch (error) {
			if (handle.detached) return;
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
			apsPushErrorToast({
				title: 'Could not run schedule',
				description: errorMessage
			});
			try {
				await refreshDetail();
			} catch {
				/* keep primary error */
			}
		} finally {
			scheduling = false;
			if (activeScheduleRun === handle) activeScheduleRun = null;
		}
	}

	function handleRunInBackground() {
		activeScheduleRun?.detach({ sticky: true });
		scheduling = false;
		apsPushToast({
			title: 'Running in background',
			description: 'You will be notified with a link when the schedule finishes.'
		});
		window.location.hash = scheduleRunsHash(planId);
	}

	/** Switch away → toast on complete; return while still running → navigate to Gantt. */
	$effect(() => {
		const handle = activeScheduleRun;
		if (!handle || !appInstanceId) return;
		if (isOsAppInstanceFocused(appInstanceId)) handle.reattach();
		else handle.detach();
	});

	/** One-shot active-run check after detail load; do not re-bind on unrelated state. */
	$effect(() => {
		const id = planId;
		const ready = !loading && Boolean(id);
		if (!ready) {
			remoteScheduling = false;
			return;
		}
		const watcher = watchActiveScheduleRun(id, (active) => {
			remoteScheduling = active;
		});
		return () => watcher.dispose();
	});

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			loading = true;
			errorMessage = null;
			notFound = false;
			try {
				await refreshDetail(controller.signal);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				detail = null;
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => {
			controller.abort();
			activeScheduleRun?.detach({ sticky: true });
		};
	});
</script>

<div class="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	{#if loading}
		<div class="space-y-4" aria-busy="true" role="status">
			<span class="sr-only">Loading schedule setup</span>
			<div class="border border-border bg-surface px-4 py-3">
				<div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
					<div class="flex min-w-0 flex-1 flex-wrap items-center gap-3">
						<Skeleton class="h-7 w-40" />
						<Skeleton class="h-4 w-64 max-w-full" />
					</div>
					<div class="flex gap-2">
						<Skeleton class="h-8 w-28" />
						<Skeleton class="h-8 w-32" />
					</div>
				</div>
			</div>
			<Skeleton class="h-64 w-full" />
		</div>
	{:else if notFound || !detail}
		<div class="border border-border bg-surface p-6">
			<p class="text-sm font-medium text-foreground">Schedule request not found</p>
			<p class="mt-1 text-sm text-muted-foreground">
				{errorMessage ?? 'The selected request is unavailable. Go back to APS Runs and try again.'}
			</p>
			<div class="mt-4">
				<Button
					variant="outline"
					size="sm"
					label="Back to APS Runs"
					icon={ArrowLeft}
					class="rounded-none"
					onclick={navigateToPlans}
				/>
			</div>
		</div>
	{:else}
		<div
			class="flex flex-col gap-4 border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
		>
			<div class="flex min-w-0 flex-wrap items-center gap-3">
				<Badge
					variant="default"
					label={detail.planName}
					dot={false}
					class="rounded-none px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
				/>
				<p class="text-sm text-muted-foreground">
					{detail.boms.length} BOMs
				</p>
			</div>

			<div class="flex shrink-0 flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="md"
					label="APS Runs"
					icon={ArrowLeft}
					class="rounded-none"
					onclick={navigateToPlans}
				/>
				<Button
					variant="outline"
					size="md"
					label="All Runs"
					icon={History}
					class="rounded-none"
					onclick={navigateToRuns}
				/>
				<Button
					variant="primary"
					size="md"
					label={runScheduleLabel}
					icon={Play}
					class="rounded-none"
					disabled={!canRunSchedule}
					onclick={runSchedule}
				/>
			</div>
		</div>

		{#if detail.errorMessage}
			<Alert
				variant={detail.errorCode === 'aps.validation' ? 'warning' : 'error'}
				title={detail.errorCode === 'aps.no_scope' ? 'Nothing to schedule' : 'Schedule setup'}
				description={detail.errorMessage}
			/>
		{/if}

		<div class="flex min-h-0 min-w-0 flex-1 flex-col">
			<TreeTable
				nodes={treeNodes}
				{columns}
				bind:expandedIds
				filterMatch={scheduleSetupTreeFilterMatch}
				rowClass={treeRowClass}
				search={{
					enabled: true,
					placeholder: 'Search projects, schedules, structures, BOMs...'
				}}
				emptyState={{
					icon: Package,
					title: 'No BOMs',
					description:
						detail.errorMessage ?? 'No delivery schedule lines are in scope for this request.'
				}}
			/>
		</div>
	{/if}

	<AppBusyOverlay
		open={isScheduling}
		title="Scheduling"
		description={remoteScheduling && !scheduling
			? 'A schedule is already running for this plan. This may take a moment…'
			: 'Running the APS scheduler. This may take a moment…'}
		actionLabel={showRunInBackground ? 'Run in background' : ''}
		onAction={showRunInBackground ? handleRunInBackground : undefined}
	/>
</div>
