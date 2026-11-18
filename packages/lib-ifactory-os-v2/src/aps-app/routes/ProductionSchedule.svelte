<script lang="ts">
	import {
		Alert,
		Badge,
		Button,
		DateInput,
		Dialog,
		GanttChart,
		GanttJobContextMenu,
		GanttMoveConfirmDialog,
		ResourceUtilizationPanel,
		ScheduleDetailsPanel,
		ScheduleExplorerSidebar,
		Skeleton,
		buildValidMachinesByJob,
		configureGanttViewport,
		ganttState,
		jobsFromScheduleTasks,
		machinesFromResources,
		markSlug,
		computeScheduleTreeColors,
		resetGanttEditState,
		resourceGroupsFromMachines
	} from '@ifactory/ui-v2';
	import type { Machine, ScheduledJob, ScheduleConfirmChange } from '@ifactory/ui-v2';
	import AppBusyOverlay from '../../lib/appShell/AppBusyOverlay.svelte';
	import ScheduleConfirmChangeDialog from '../components/ScheduleConfirmChangeDialog.svelte';
	import { buildConfirmChange } from '../lib/build-confirm-change.js';
	import {
		ArrowLeft,
		ClipboardList,
		Factory,
		History,
		Minus,
		Pencil,
		Play,
		Plus,
		Settings
	} from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { getContext, onMount } from 'svelte';
	import { APP_INSTANCE_ID_CONTEXT } from '../../lib/appShell/appSharedState.js';
	import { isOsAppInstanceFocused } from '../../lib/os/app-focus.svelte.js';
	import {
		loadProductionSchedule,
		isPlanScheduleActive,
		type ApsFixedTask
	} from '../lib/production-schedule.api.js';
	import {
		startApsScheduleRun,
		type ApsScheduleRunHandle
	} from '../lib/aps-schedule-background.js';
	import {
		ganttHighlightIdsForTreeSelection,
		sectionIdFromTreeNodeId
	} from '../lib/production-schedule.derive.js';
	import { watchActiveScheduleRun } from '../lib/active-schedule-run-poll.js';
	import type { ProductionScheduleData } from '../lib/production-schedule.types.js';
	import { jobCardsHash, publishApsRun } from '../lib/job-cards.api.js';
	import { apsPushErrorToast, apsPushSuccessToast, apsPushToast } from '../lib/toast.js';
	import { user } from '../../lib/os/index.svelte.js';
	import { machinesReportHash } from '../lib/reports.api.js';
	import { rememberScheduleRunLabel, scheduleRunsHash } from '../lib/schedule-runs.js';
	import { reviewInputHash } from '../lib/manufacturing-plans.js';
	import {
		ddMmYyyyToOffsetIso,
		formatSimulationStartLabel,
		isoToDdMmYyyy
	} from '../lib/scheduler-datetime.js';

	const SCHEDULER_SIM_START_KEY = 'production_schedule_sim_start';

	let { params } = $props();

	const planId = $derived(String(params.planId ?? ''));
	const selectedRunId = $derived(String(params.runId ?? '').trim() || undefined);
	/** History browse (`…/ProductionSchedule/:runId`) is read-only - no edit / reschedule. */
	const isHistoricalRun = $derived(Boolean(selectedRunId));
	const appInstanceId = getContext<string>(APP_INSTANCE_ID_CONTEXT);

	let loading = $state(true);
	let scheduling = $state(false);
	let publishing = $state(false);
	let remoteScheduling = $state(false);
	let errorMessage = $state<string | null>(null);
	let planExists = $state(false);
	let schedule = $state<ProductionScheduleData | null>(null);
	let runPublished = $state(false);
	let activeScheduleRun = $state.raw<ApsScheduleRunHandle | null>(null);

	const isScheduling = $derived(scheduling || remoteScheduling);
	const isCurrentRunPublished = $derived(runPublished);
	const isProvisional = $derived(schedule != null && schedule.sourcesFrozen === false);
	const busyOverlayTitle = $derived(scheduling ? 'Rescheduling' : 'Scheduling');
	const runScheduleLabel = $derived(isScheduling ? 'Running…' : 'Run Schedule');
	const rerunScheduleLabel = $derived(isScheduling ? 'Running…' : 'Rerun Schedule');
	const showRunInBackground = $derived(Boolean(scheduling && activeScheduleRun));

	let ganttMachines = $state<Machine[]>([]);
	let ganttJobs = $state<ScheduledJob[]>([]);
	let utilizationOpen = $state(true);
	let ordersExplorerOpen = $state(true);

	const utilizationGroups = $derived(resourceGroupsFromMachines(ganttMachines));

	let editMode = $state(false);
	let confirmOpen = $state(false);
	let settingsOpen = $state(false);
	let settingsDateValue = $state('');
	let simulationStartIso = $state(new Date().toISOString());
	let selectedNodeId = $state('all');
	let selectedTaskId = $state<string | null>(null);
	/** Mark / tree id driving the details panel (e.g. j55-da-89h or J55 DA 89H). */
	let selectedMarkKey = $state<string | null>(null);
	/** Mark whose flow arrows are shown - set only when a Gantt bar is clicked. */
	let flowArrowOrderId = $state<string | null>(null);
	let detailsOpen = $state(false);
	/** Orders tree expansion - All orders open by default. */
	let treeExpanded = $state<Record<string, boolean>>({ all: true });
	let mainScrollLeft = $state(0);
	let contextMenuPos = $state<{ x: number; y: number } | null>(null);
	let contextMenuJob = $state<ScheduledJob | null>(null);
	let hasPendingMoves = $state(false);
	let confirmChangePreview = $state<ScheduleConfirmChange | null>(null);

	const simulationStartMs = $derived(new Date(simulationStartIso).getTime());

	const scheduleStartLabel = $derived(formatSimulationStartLabel(simulationStartMs));

	function simStartStorageKey(id: string): string {
		return `${SCHEDULER_SIM_START_KEY}:${id}`;
	}

	function loadSimulationStart(id: string, fallbackIso: string): string {
		try {
			const saved = localStorage.getItem(simStartStorageKey(id));
			if (saved?.trim()) return saved.trim();
		} catch {
			/* ignore */
		}
		return fallbackIso;
	}

	function persistSimulationStart(id: string, iso: string) {
		try {
			localStorage.setItem(simStartStorageKey(id), iso);
		} catch {
			/* ignore */
		}
	}

	function formatClock(minFromStart: number): string {
		const d = new Date(simulationStartMs + minFromStart * 60_000);
		return d.toLocaleString([], {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	function resolveJobDetail(markKey: string | null, taskId: string | null = null) {
		if (!schedule) return null;

		if (taskId) {
			const byTask = schedule.jobDetailsByTaskId[taskId];
			if (byTask) return byTask;
		}

		if (!markKey) return null;

		const byId = schedule.jobDetailsByMarkId[markKey];
		if (byId) return byId;

		const slug = markSlug(markKey);
		const bySlug = schedule.jobDetailsByMarkId[slug];
		if (bySlug) return bySlug;

		const byTitle = Object.values(schedule.jobDetailsByMarkId).find(
			(detail) => markSlug(detail.title) === slug || detail.title === markKey
		);
		if (byTitle) return byTitle;

		const task =
			(taskId ? schedule.tasks.find((t) => t.id === taskId) : undefined) ??
			schedule.tasks.find((t) => t.jobCardId === markKey) ??
			schedule.tasks.find((t) => t.bomItemId === markKey) ??
			schedule.tasks.find((t) => t.id === markKey) ??
			schedule.tasks.find((t) => t.markLabel === markKey) ??
			schedule.tasks.find((t) => markSlug(t.markLabel ?? '') === slug);

		if (!task) return null;

		const title = task.markLabel ?? task.label;
		const endMin = task.startMin + task.durationMin;
		return {
			title,
			color: task.color,
			sections: [
				{
					title: 'Assignment',
					fields: [{ label: 'Machine', value: task.resourceId }]
				},
				{
					title: 'Production',
					fields: [
						{ label: 'Product', value: title },
						{ label: 'Qty', value: task.qty ?? 1 },
						{ label: 'Holes', value: '-' },
						{ label: 'RM ID', value: '-' }
					]
				},
				{
					title: 'Timing',
					fields: [
						{ label: 'Start', value: formatClock(task.startMin) },
						{ label: 'End', value: formatClock(endMin) },
						{ label: 'Duration', value: `${task.durationMin}m` },
						...(task.changeoverMin
							? [{ label: 'Changeover before', value: `${task.changeoverMin}m` }]
							: [])
					]
				}
			]
		};
	}

	const treeColors = $derived(
		schedule ? computeScheduleTreeColors(schedule.orderTree, treeExpanded, selectedNodeId) : null
	);

	const selectedJob = $derived.by(() => {
		const job = resolveJobDetail(selectedMarkKey, selectedTaskId);
		if (!job || !treeColors || !selectedMarkKey) return job;
		const color =
			treeColors.colorByMarkId[selectedMarkKey] ??
			treeColors.colorByMarkId[markSlug(selectedMarkKey)];
		return color ? { ...job, color } : job;
	});

	/** Selection-driven greying: section / RMID / marking ids under the selected tree node. */
	const ganttHighlightIds = $derived(
		schedule ? ganttHighlightIdsForTreeSelection(schedule.orderTree, selectedNodeId) : null
	);

	const ganttArrowOrderId = $derived.by(() => {
		if (!flowArrowOrderId) return null;
		const stepCount = ganttJobs.filter((job) => job.order_id === flowArrowOrderId).length;
		return stepCount > 1 ? flowArrowOrderId : null;
	});

	const ganttSelectedOrder = $derived(
		!selectedNodeId || selectedNodeId === 'all' ? 'all' : selectedNodeId
	);

	$effect(() => {
		const colorByNodeId = treeColors?.colorByNodeId;
		const colorByMarkId = treeColors?.colorByMarkId;
		if (!colorByNodeId && !colorByMarkId) return;
		for (const job of ganttJobs) {
			const color = colorByNodeId?.[job.order_id] ?? colorByMarkId?.[job.order_id];
			if (color) job.color = color;
		}
	});

	const currentTimeMs = $derived(
		schedule ? simulationStartMs + schedule.currentTimeMin * 60_000 : null
	);

	function applyScheduleData(data: ProductionScheduleData, startMs = simulationStartMs) {
		ganttMachines = machinesFromResources(data.resources);
		const byId = new Map(data.tasks.map((task) => [task.id, task]));
		// ponytail: published ui-v2 jobsFromScheduleTasks still keys order_id by bom_item/mark
		ganttJobs = jobsFromScheduleTasks(data.tasks, startMs).map((job) => {
			const task = byId.get(job.task_uid ?? '');
			const orderId = task?.jobCardId?.trim();
			return {
				...job,
				...(orderId ? { order_id: orderId } : {}),
				...(task?.highlightIds ? { highlightIds: task.highlightIds } : {})
			};
		});
		configureGanttViewport(ganttJobs, startMs);
		ganttState.zoom = 5;
	}

	function adoptSchedule(data: ProductionScheduleData) {
		schedule = data;
		planExists = true;
		simulationStartIso = loadSimulationStart(planId, data.scheduleStartIso);
		selectedNodeId = 'all';
		selectedMarkKey = null;
		flowArrowOrderId = null;
		selectedTaskId = null;
		treeExpanded = { all: true };
		editMode = false;
		hasPendingMoves = false;
		detailsOpen = false;
		settingsOpen = false;
		resetGanttEditState();
		ganttState.lockedTasks.clear();
		applyScheduleData(data, new Date(simulationStartIso).getTime());
	}

	function openSchedulerSettings() {
		settingsDateValue = isoToDdMmYyyy(simulationStartIso || new Date().toISOString());
		settingsOpen = true;
	}

	function saveSchedulerSettings() {
		const iso = ddMmYyyyToOffsetIso(settingsDateValue);
		if (!iso) return;
		simulationStartIso = iso;
		persistSimulationStart(planId, iso);
		settingsOpen = false;
		if (schedule) applyScheduleData(schedule, new Date(iso).getTime());
	}

	async function handleRunOrRerun() {
		if (!planId || isScheduling || isHistoricalRun) return;
		try {
			const active = await isPlanScheduleActive(planId);
			if (active) {
				remoteScheduling = true;
				return;
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
			return;
		}
		scheduling = true;
		errorMessage = null;
		settingsOpen = false;
		const handle = startApsScheduleRun({ planId, kind: 'schedule' });
		activeScheduleRun = handle;
		try {
			const data = await handle.promise;
			if (handle.detached) return;
			adoptSchedule(data);
		} catch (error) {
			if (handle.detached) return;
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
		} finally {
			scheduling = false;
			if (activeScheduleRun === handle) activeScheduleRun = null;
		}
	}

	function resetSchedule() {
		editMode = false;
		hasPendingMoves = false;
		resetGanttEditState();
		ganttState.lockedTasks.clear();
		selectedTaskId = null;
		selectedNodeId = 'all';
		selectedMarkKey = null;
		flowArrowOrderId = null;
		treeExpanded = { all: true };
		detailsOpen = false;
		if (schedule) {
			simulationStartIso = schedule.scheduleStartIso;
			applyScheduleData(schedule, new Date(simulationStartIso).getTime());
		}
	}

	function startEditMode() {
		if (isHistoricalRun) return;
		editMode = true;
		ganttState.validMachinesByJob = buildValidMachinesByJob(ganttJobs, ganttMachines);
	}

	function discardChanges() {
		editMode = false;
		hasPendingMoves = false;
		resetGanttEditState();
		ganttState.lockedTasks.clear();
		if (schedule) applyScheduleData(schedule);
	}

	function openConfirmDialog() {
		if (!schedule || ganttState.lockedTasks.size === 0) return;

		const machineLabels = new Map(
			ganttMachines.map((machine) => [machine.machine_id, machine.machine_name])
		);
		const lockedIds = new Set(ganttState.lockedTasks.keys());
		const affectedMachines = new Set(
			[...ganttState.lockedTasks.values()].map((fixed) => fixed.machine_id)
		);
		const otherTasksOnAffectedMachines = ganttJobs.filter((job) => {
			const id = job.task_uid ?? `${job.order_id}_${job.node_id}`;
			return !lockedIds.has(id) && affectedMachines.has(job.machine_id);
		}).length;

		confirmChangePreview = buildConfirmChange(
			schedule.tasks,
			ganttState.lockedTasks,
			machineLabels,
			simulationStartMs,
			otherTasksOnAffectedMachines
		);
		confirmOpen = true;
	}

	async function confirmChanges() {
		if (!schedule || isScheduling || isHistoricalRun) return;
		const taskById = new Map(schedule.tasks.map((task) => [task.id, task]));
		const fixedTasks: ApsFixedTask[] = [];
		let missingPin = false;
		for (const [taskId, fixed] of ganttState.lockedTasks) {
			const task = taskById.get(taskId);
			if (!task?.stepId) continue;
			const pinOrderId = task.pinOrderId?.trim();
			if (!pinOrderId) {
				missingPin = true;
				continue;
			}
			fixedTasks.push({
				order_id: pinOrderId,
				node_id: task.stepId,
				machine_id: fixed.machine_id,
				start: new Date(fixed.start).toISOString(),
				end: new Date(fixed.end).toISOString()
			});
		}
		if (ganttState.lockedTasks.size === 0) return;
		if (missingPin || fixedTasks.length === 0) {
			errorMessage =
				'Cannot replan: locked tasks have no pin token. Run the schedule once so tasks include metadata.order_id.';
			confirmOpen = false;
			return;
		}

		try {
			const active = await isPlanScheduleActive(planId);
			if (active) {
				remoteScheduling = true;
				confirmOpen = false;
				return;
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
			confirmOpen = false;
			return;
		}

		scheduling = true;
		confirmOpen = false;
		confirmChangePreview = null;
		errorMessage = null;
		const handle = startApsScheduleRun({
			planId,
			kind: 'replan',
			runId: schedule.runId,
			fixedTasks,
			scheduleStart: simulationStartIso
		});
		activeScheduleRun = handle;
		try {
			const data = await handle.promise;
			if (handle.detached) return;
			adoptSchedule(data);
		} catch (error) {
			if (handle.detached) return;
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
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

	function expandPathToNode(targetId: string) {
		if (!schedule) return;
		if (targetId === 'all') {
			treeExpanded = { all: true };
			return;
		}
		const path = findTreePathIds(schedule.orderTree, targetId);
		if (!path?.length) return;
		const next: Record<string, boolean> = { ...treeExpanded, all: true };
		for (const id of path) next[id] = true;
		treeExpanded = next;
	}

	function findTreePathIds(
		nodes: ProductionScheduleData['orderTree'],
		targetId: string,
		path: string[] = []
	): string[] | null {
		for (const node of nodes) {
			const next = [...path, node.id];
			if (node.id === targetId) return next;
			if (node.children?.length) {
				const found = findTreePathIds(node.children, targetId, next);
				if (found) return found;
			}
		}
		return null;
	}

	function handleSelectNode(id: string) {
		selectedNodeId = id;
		const cardId = sectionIdFromTreeNodeId(id);
		selectedMarkKey = cardId;
		flowArrowOrderId = null;
		const taskId =
			schedule?.tasks.find(
				(t) =>
					t.jobCardId === cardId ||
					t.jobCardId === id ||
					t.bomItemId === id ||
					t.id === id ||
					markSlug(t.markLabel ?? '') === markSlug(id) ||
					t.markLabel === id
			)?.id ?? null;
		selectedTaskId = taskId;
		detailsOpen = Boolean(resolveJobDetail(cardId, taskId));
		expandPathToNode(id);
	}

	function findTaskIdForJob(job: ScheduledJob): string | null {
		if (!schedule) return null;
		const identity = job.order_id;
		const onMachine = schedule.tasks.filter(
			(task) =>
				task.resourceId === job.machine_id &&
				(task.jobCardId === identity ||
					task.bomItemId === identity ||
					task.id === job.task_uid ||
					task.markLabel === job.order_number ||
					markSlug(task.markLabel ?? '') === markSlug(job.order_number))
		);
		if (onMachine.length === 0) {
			return (
				schedule.tasks.find(
					(task) =>
						task.jobCardId === identity ||
						task.bomItemId === identity ||
						task.id === job.task_uid ||
						task.markLabel === job.order_number ||
						markSlug(task.markLabel ?? '') === markSlug(job.order_number)
				)?.id ?? null
			);
		}
		if (onMachine.length === 1) return onMachine[0]!.id;
		const jobStartMin = Math.round((job.start - simulationStartMs) / 60_000);
		return (
			onMachine.find((task) => Math.abs(task.startMin - jobStartMin) <= 2)?.id ?? onMachine[0]!.id
		);
	}

	function handleJobClick(job: ScheduledJob) {
		const identity = job.order_id;
		selectedTaskId = job.task_uid ?? findTaskIdForJob(job);
		selectedMarkKey = identity;
		selectedNodeId = identity;
		flowArrowOrderId = identity;
		detailsOpen = true;
		expandPathToNode(identity);
	}

	function handleJobContextMenu(e: MouseEvent, job: ScheduledJob) {
		if (!editMode) return;
		contextMenuJob = job;
		contextMenuPos = { x: e.clientX, y: e.clientY };
	}

	function handleContextMenuSelect(action: string) {
		if (!contextMenuJob) return;

		if (action === 'properties') {
			handleJobClick(contextMenuJob);
		} else if (action === 'move_task') {
			ganttState.placingJob = contextMenuJob;
			ganttState.originalJobState = {
				start: contextMenuJob.start,
				end: contextMenuJob.end,
				machine_id: contextMenuJob.machine_id
			};
			ganttState.draggingJob = contextMenuJob;
			ganttState.hasMoved = true;
		}

		contextMenuJob = null;
		contextMenuPos = null;
	}

	function handleMoveAccept() {
		hasPendingMoves = true;
		ganttJobs = [...ganttJobs];
	}

	function navigateToReview() {
		window.location.hash = reviewInputHash(planId);
	}

	function navigateToPlans() {
		window.location.hash = '#/ShopFloorPlanning/ApsRuns';
	}

	function navigateToMachinesReport() {
		window.location.hash = machinesReportHash(planId);
	}

	function navigateToJobCards() {
		window.location.hash = jobCardsHash(planId, schedule?.runId);
	}

	async function handlePublish() {
		if (!schedule || publishing || isCurrentRunPublished) return;
		if (schedule.sourcesFrozen === false) {
			apsPushErrorToast({
				title: 'Cannot publish provisional run',
				description: 'Freeze the draft shop-floor month(s) and re-run the schedule first.'
			});
			return;
		}
		publishing = true;
		errorMessage = null;
		try {
			await publishApsRun(planId, schedule.runId, user.email ?? '');
			runPublished = true;
			schedule = {
				...schedule,
				publishedAt: new Date().toISOString(),
				publishedBy: user.email ?? null,
				isPublished: true
			};
			apsPushSuccessToast({
				title: 'Schedule published',
				description: 'Job cards are marked as the released set.'
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			const message = formatApiErrorMessage(error);
			errorMessage = message;
			apsPushErrorToast({ title: 'Publish failed', description: message });
		} finally {
			publishing = false;
		}
	}

	function navigateToRuns() {
		window.location.hash = scheduleRunsHash(planId);
	}

	$effect(() => {
		const id = planId;
		const historical = isHistoricalRun;
		if (!id || historical) {
			remoteScheduling = false;
			return;
		}
		return watchActiveScheduleRun(id, (active) => {
			remoteScheduling = active;
		}).dispose;
	});

	/** Switch away → toast on complete; return while still running → adopt Gantt in-page. */
	$effect(() => {
		const handle = activeScheduleRun;
		if (!handle || !appInstanceId) return;
		if (isOsAppInstanceFocused(appInstanceId)) handle.reattach();
		else handle.detach();
	});

	onMount(() => {
		return () => {
			activeScheduleRun?.detach({ sticky: true });
		};
	});

	$effect(() => {
		const id = planId;
		const runId = selectedRunId;
		if (runId) {
			editMode = false;
			hasPendingMoves = false;
			resetGanttEditState();
		}
		const controller = new AbortController();
		loading = true;
		errorMessage = null;
		void (async () => {
			try {
				const result = await loadProductionSchedule(id, controller.signal, runId);
				planExists = result.planExists;
				if (result.schedule) {
					rememberScheduleRunLabel(result.schedule.runId, result.schedule.version);
					runPublished = result.schedule.isPublished ?? Boolean(result.schedule.publishedAt);
					adoptSchedule(result.schedule);
				} else {
					schedule = null;
					runPublished = false;
				}
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				planExists = false;
				schedule = null;
				runPublished = false;
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
	{#if errorMessage}
		<div class="m-4 shrink-0">
			<Alert
				variant="error"
				title="Could not load production schedule"
				description={errorMessage}
			/>
		</div>
	{/if}

	{#if loading}
		<div class="m-4 space-y-4" aria-busy="true" role="status">
			<span class="sr-only">Loading production schedule</span>
			<Skeleton class="h-14 w-full" />
			<Skeleton class="h-112 w-full" />
		</div>
	{:else if !planExists}
		<div class="m-8 border border-border bg-background p-6">
			<p class="text-sm font-medium text-foreground">Manufacturing plan not found</p>
			<p class="mt-1 text-sm text-muted-foreground">
				The selected plan is unavailable. Go back to manufacturing plans and try again.
			</p>
			<div class="mt-4">
				<Button
					variant="outline"
					size="sm"
					label="Back to plans"
					icon={ArrowLeft}
					class="rounded-none"
					onclick={navigateToPlans}
				/>
			</div>
		</div>
	{:else if !schedule}
		<div class="m-8 border border-border bg-background p-6">
			<p class="text-sm font-medium text-foreground">No production schedule yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Run the APS scheduler to generate a Gantt for this manufacturing plan. Requires the APS
				orchestrator and solver to be running.
			</p>
			<div class="mt-4 flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					label="Back to Review Input"
					icon={ArrowLeft}
					class="rounded-none"
					onclick={navigateToReview}
				/>
				<Button
					variant="primary"
					size="sm"
					label={runScheduleLabel}
					icon={Play}
					class="rounded-none"
					disabled={isScheduling}
					onclick={handleRunOrRerun}
				/>
			</div>
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
			{#if isProvisional}
				<Alert
					variant="warning"
					title="Provisional schedule"
					description="Built from draft shop-floor months. Freeze those months and re-run before publishing."
				/>
			{/if}
			<!-- HeaderBar -->
			<div class="flex shrink-0 flex-col gap-2 border border-border bg-background px-4 py-3">
				<div class="flex w-full flex-wrap items-center gap-2">
					<Badge
						variant="default"
						label={schedule.releaseLabel}
						dot={false}
						class="max-w-full shrink-0 border border-primary bg-[#FFF4ED] px-2.5 py-1 text-[11px] font-medium tracking-wide text-primary uppercase"
					/>
					{#if schedule.version != null}
						<Badge
							variant="outline"
							label={`v${schedule.version}`}
							dot={false}
							class="shrink-0 border-primary px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap text-primary uppercase"
						/>
					{/if}
					{#if isHistoricalRun}
						<Badge
							variant="outline"
							label="Read only"
							dot={false}
							class="shrink-0 border-border px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
						/>
					{/if}
					{#if isProvisional}
						<Badge
							variant="outline"
							label="Provisional"
							dot={false}
							class="shrink-0 border-status-warning px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap text-status-warning uppercase"
						/>
					{/if}
					{#if isCurrentRunPublished}
						<Badge
							variant="online"
							label="Published"
							dot={false}
							class="shrink-0 px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap uppercase"
						/>
					{/if}
					{#if editMode}
						<Badge
							variant="outline"
							label="Edit mode"
							dot={false}
							class="shrink-0 border-primary px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap text-primary uppercase"
						/>
					{/if}
					<Badge
						variant="secondary"
						label={`Start: ${scheduleStartLabel}`}
						dot={false}
						class="shrink-0 border border-border bg-background px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
					/>
					<Badge
						variant="secondary"
						label={`Makespan ${schedule.makespanLabel}`}
						dot={false}
						class="shrink-0 border border-border bg-background px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
					/>
					<Badge
						variant="secondary"
						label={`${schedule.taskCount} tasks`}
						dot={false}
						class="shrink-0 border border-border bg-background px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
					/>
				</div>

				<div class="flex w-full flex-wrap items-center justify-end gap-2">
					{#if editMode}
						<Button variant="outline" size="sm" label="Discard" onclick={discardChanges} />
						<Button
							variant="primary"
							size="sm"
							label="Confirm & Rerun"
							disabled={!hasPendingMoves || isScheduling}
							onclick={openConfirmDialog}
						/>
					{:else}
						<Button
							variant="outline"
							size="sm"
							label="All Runs"
							icon={History}
							onclick={navigateToRuns}
						/>
						<Button
							variant="outline"
							size="sm"
							label="Job Cards"
							icon={ClipboardList}
							onclick={navigateToJobCards}
						/>
						<!-- <Button
							variant="outline"
							size="sm"
							label="Schedule Report"
							icon={FileText}
							onclick={navigateToScheduleReport}
						/> -->
						<Button
							variant="outline"
							size="sm"
							label="Machines Report"
							icon={Factory}
							onclick={navigateToMachinesReport}
						/>
						<div class="flex items-center gap-0.5 bg-[#F4F4F5] p-0.5">
							<Button
								variant="outline"
								size="icon"
								icon={Minus}
								class="size-8 border-border bg-background"
								aria-label="Zoom out"
								onclick={() => (ganttState.zoom = Math.max(0.1, ganttState.zoom / 1.2))}
							/>
							<Button
								variant="outline"
								size="icon"
								icon={Plus}
								class="size-8 border-border bg-background"
								aria-label="Zoom in"
								onclick={() => (ganttState.zoom = Math.min(20, ganttState.zoom * 1.2))}
							/>
						</div>
						{#if !isCurrentRunPublished}
							<Button
								variant="outline"
								size="sm"
								label={publishing ? 'Publishing…' : 'Publish'}
								class="min-w-28 px-5"
								disabled={isScheduling || publishing || isProvisional}
								onclick={handlePublish}
							/>
						{/if}
						{#if !isHistoricalRun}
							<Button
								variant="outline"
								size="icon"
								icon={Settings}
								class="size-8"
								aria-label="Scheduler settings"
								onclick={openSchedulerSettings}
							/>
							<Button
								variant="ghost"
								size="sm"
								label="Reset"
								class="px-4 text-status-error"
								onclick={resetSchedule}
							/>
							<Button
								variant="outline"
								size="sm"
								label="Edit"
								icon={Pencil}
								onclick={startEditMode}
							/>
							<Button
								variant="primary"
								size="sm"
								label={rerunScheduleLabel}
								class="px-5 font-bold"
								disabled={isScheduling || publishing}
								onclick={handleRunOrRerun}
							/>
						{/if}
					{/if}
				</div>
			</div>

			{#if editMode}
				<Alert
					variant="info"
					description="Drag a task to another machine of the same group, drag horizontally to shift time, or right-click a task and choose Move Task. Accept each move, then confirm all changes."
				/>
			{/if}

			<!-- Grid-Panel: Explorer + Gantt + Details + Utilization -->
			<div class="flex min-h-0 flex-1 gap-3 overflow-hidden">
				<ScheduleExplorerSidebar
					bind:open={ordersExplorerOpen}
					orderTree={schedule.orderTree}
					resources={schedule.resources}
					{selectedNodeId}
					bind:expanded={treeExpanded}
					colorByNodeId={treeColors?.colorByNodeId ?? {}}
					dimmedNodeIds={treeColors?.dimmedNodeIds ?? new Set()}
					ordersTabLabel="Orders"
					onSelectNode={handleSelectNode}
					class="h-full"
				/>

				<div class="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
					<div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
						<div
							class="relative min-h-0 min-w-0 flex-1 overflow-hidden border border-border bg-background"
						>
							{#if ganttMachines.length > 0}
								<GanttChart
									resources={ganttMachines}
									jobs={ganttJobs}
									downtimes={[]}
									edges={schedule.dependencyEdges}
									arrowOrderId={ganttArrowOrderId}
									selectedOrder={ganttSelectedOrder}
									highlightedOrderIds={ganttHighlightIds}
									editMode={!isHistoricalRun && editMode}
									{currentTimeMs}
									onJobClick={handleJobClick}
									onJobContextMenu={handleJobContextMenu}
									bind:scrollLeft={mainScrollLeft}
									class="h-full border-0"
								/>
							{/if}
						</div>

						<ResourceUtilizationPanel
							bind:open={utilizationOpen}
							jobs={ganttJobs}
							resourceGroups={utilizationGroups}
							bind:scrollLeft={mainScrollLeft}
							{currentTimeMs}
							class="shrink-0"
						/>
					</div>

					{#if detailsOpen && selectedJob}
						<ScheduleDetailsPanel
							open={detailsOpen}
							job={selectedJob}
							onClose={() => (detailsOpen = false)}
							class="h-full border border-border"
						/>
					{/if}
				</div>
			</div>
		</div>

		{#if contextMenuPos && contextMenuJob}
			<GanttJobContextMenu
				x={contextMenuPos.x}
				y={contextMenuPos.y}
				job={contextMenuJob}
				onSelect={handleContextMenuSelect}
				onClose={() => {
					contextMenuPos = null;
					contextMenuJob = null;
				}}
			/>
		{/if}

		<GanttMoveConfirmDialog
			jobs={ganttJobs}
			onAccept={handleMoveAccept}
			onReject={() => {
				ganttJobs = [...ganttJobs];
			}}
		/>

		<Dialog
			bind:open={settingsOpen}
			title="Scheduler settings"
			size="md"
			confirmLabel="Save"
			cancelLabel="Cancel"
			class="border border-border"
			onConfirm={saveSchedulerSettings}
		>
			<div class="space-y-1.5">
				<label class="block text-sm font-medium text-foreground" for="scheduler-simulation-start">
					Simulation start
				</label>
				<DateInput id="scheduler-simulation-start" bind:value={settingsDateValue} class="w-full" />
			</div>
		</Dialog>

		<ScheduleConfirmChangeDialog
			bind:open={confirmOpen}
			change={confirmChangePreview ?? schedule.confirmChange}
			onOpenChange={(next) => {
				confirmOpen = next;
				if (!next) confirmChangePreview = null;
			}}
			onConfirm={confirmChanges}
		/>
	{/if}

	<AppBusyOverlay
		open={isScheduling}
		title={busyOverlayTitle}
		description={remoteScheduling && !scheduling
			? 'A schedule is already running for this plan. This may take a moment…'
			: 'Running the APS scheduler. This may take a moment…'}
		actionLabel={showRunInBackground ? 'Run in background' : ''}
		onAction={showRunInBackground ? handleRunInBackground : undefined}
	/>
</div>
