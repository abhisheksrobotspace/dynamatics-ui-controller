<script lang="ts">
	import Dialog from '$lib/components/ui/dialog/dialog.svelte';
	import { ganttState } from '$lib/gantt/state.svelte';
	import type { ScheduledJob } from '$lib/gantt/aps-types';

	type AcceptPayload = {
		orderId: string;
		nodeId: string;
		taskId: string;
		machineId: string;
		startMin: number;
		endMin: number;
	};

	type Props = {
		jobs?: ScheduledJob[];
		onAccept?: (payload: AcceptPayload) => void;
		onReject?: () => void;
		class?: string;
	};

	let { jobs = [], onAccept, onReject, class: className = '' }: Props = $props();

	function handleAccept() {
		if (ganttState.confirmMoveJob) {
			const jobId = ganttState.getJobId(ganttState.confirmMoveJob);
			const fixedState = {
				start: ganttState.confirmMoveJob.start,
				end: ganttState.confirmMoveJob.end,
				machine_id: ganttState.confirmMoveJob.machine_id
			};
			ganttState.lockedTasks.set(jobId, fixedState);
			ganttState.confirmMoveJob.isFixed = true;

			const simStart = ganttState.simulationStartTime || 0;
			onAccept?.({
				orderId: ganttState.confirmMoveJob.order_id,
				nodeId: ganttState.confirmMoveJob.node_id ?? '',
				taskId: jobId,
				machineId: fixedState.machine_id,
				startMin: Math.round((fixedState.start - simStart) / 60_000),
				endMin: Math.round((fixedState.end - simStart) / 60_000)
			});
		}

		ganttState.confirmMoveJob = null;
		ganttState.placingJob = null;
		ganttState.originalJobState = null;
		ganttState.dragSnapshot = null;
	}

	function handleReject() {
		if (ganttState.dragSnapshot?.length) {
			ganttState.restoreDragSnapshot(jobs);
		} else if (ganttState.originalJobState && ganttState.confirmMoveJob) {
			ganttState.confirmMoveJob.start = ganttState.originalJobState.start;
			ganttState.confirmMoveJob.end = ganttState.originalJobState.end;
			ganttState.confirmMoveJob.machine_id = ganttState.originalJobState.machine_id;
		}
		ganttState.confirmMoveJob = null;
		ganttState.placingJob = null;
		ganttState.originalJobState = null;
		ganttState.dragSnapshot = null;
		onReject?.();
	}

	function formatTime(ts: number) {
		return new Date(ts).toLocaleString([], {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getMachineName(id: string) {
		const resource = ganttState.resources.find((r) => r.machine_id === id);
		return resource ? resource.machine_name : id;
	}

	function handleOpenChange(next: boolean) {
		if (!next && ganttState.confirmMoveJob) handleReject();
	}
</script>

{#if ganttState.confirmMoveJob && ganttState.originalJobState}
	{@const job = ganttState.confirmMoveJob}
	{@const original = ganttState.originalJobState}
	<Dialog
		open={true}
		title="Confirm Task Relocation"
		size="md"
		confirmLabel="Accept"
		cancelLabel="Reject"
		class={className || 'border border-border'}
		onConfirm={handleAccept}
		onCancel={handleReject}
		onOpenChange={handleOpenChange}
	>
		<div class="space-y-4">
			<div class="space-y-1.5">
				<span class="block text-sm font-medium text-foreground">Order</span>
				<p class="text-sm text-foreground">{job.order_number}</p>
			</div>

			<div class="space-y-1.5">
				<span class="block text-sm font-medium text-foreground">Task node</span>
				<p class="font-mono text-sm text-foreground">{job.node_id}</p>
			</div>

			<div class="space-y-4 border-t border-border pt-4">
				<div class="space-y-1.5">
					<span class="block text-sm font-medium text-foreground">From machine</span>
					<p class="text-sm text-foreground">{getMachineName(original.machine_id)}</p>
					<p class="text-sm text-muted-foreground">{formatTime(original.start)}</p>
				</div>

				<div class="space-y-1.5">
					<span class="block text-sm font-medium text-foreground">To machine</span>
					<p class="text-sm text-foreground">{getMachineName(job.machine_id)}</p>
					<p class="text-sm text-muted-foreground">{formatTime(job.start)}</p>
				</div>
			</div>
		</div>
	</Dialog>
{/if}
