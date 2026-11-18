<script lang="ts">
	import { CheckCircle2, Circle, TriangleAlert, XCircle } from '@lucide/svelte';
	import { Button, Dialog, type ScheduleConfirmChange } from '@ifactory/ui-v2';

	type Props = {
		open?: boolean;
		change: ScheduleConfirmChange;
		onOpenChange?: (open: boolean) => void;
		onConfirm?: () => void;
		class?: string;
	};

	let {
		open = $bindable(false),
		change,
		onOpenChange,
		onConfirm,
		class: className = ''
	}: Props = $props();

	function handleCancel() {
		onOpenChange?.(false);
		open = false;
	}

	function handleConfirm() {
		onConfirm?.();
		onOpenChange?.(false);
		open = false;
	}
</script>

<Dialog bind:open title="Confirm & rerun" size="lg" hideFooter class={className} {onOpenChange}>
	<div class="space-y-4">
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class="border-b border-border text-left text-xs text-muted-foreground uppercase">
					<th class="px-3 py-2 font-medium">Field</th>
					<th class="px-3 py-2 font-medium">Before</th>
					<th class="px-3 py-2 font-medium">After</th>
				</tr>
			</thead>
			<tbody>
				<tr class="border-b border-border">
					<td class="px-3 py-2 text-muted-foreground">Machine</td>
					<td
						class={[
							'px-3 py-2 font-medium',
							change.beforeMachine !== change.afterMachine && 'text-status-error line-through'
						]}
					>
						{change.beforeMachine}
					</td>
					<td class="px-3 py-2 font-medium">{change.afterMachine}</td>
				</tr>
				<tr class="border-b border-border">
					<td class="px-3 py-2 text-muted-foreground">Start</td>
					<td class="px-3 py-2 font-medium text-status-error line-through">{change.beforeStart}</td>
					<td class="px-3 py-2 font-medium">{change.afterStart}</td>
				</tr>
				<tr class="border-b border-border">
					<td class="px-3 py-2 text-muted-foreground">End</td>
					<td class="px-3 py-2 font-medium text-status-error line-through">{change.beforeEnd}</td>
					<td class="px-3 py-2 font-medium">{change.afterEnd}</td>
				</tr>
				<tr>
					<td class="px-3 py-2 text-muted-foreground">Changeover</td>
					<td class="px-3 py-2 font-medium text-status-error">{change.changeover}</td>
					<td class="px-3 py-2 font-medium">{change.changeover}</td>
				</tr>
			</tbody>
		</table>

		<div class="border border-primary/30 bg-primary/5 p-4">
			<div class="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
				<TriangleAlert class="size-4" />
				Downstream Impact
			</div>
			<ul class="space-y-2 text-sm">
				{#each change.impacts as impact (impact.text)}
					<li class="flex items-start gap-2">
						{#if impact.type === 'success'}
							<CheckCircle2 class="mt-0.5 size-4 shrink-0 text-status-online" />
							<span class="text-status-online">{impact.text}</span>
						{:else if impact.type === 'failure'}
							<XCircle class="mt-0.5 size-4 shrink-0 text-status-error" />
							<span class="text-status-error">{impact.text}</span>
						{:else}
							<Circle class="mt-0.5 size-3 shrink-0 fill-primary text-primary" />
							<span class="text-foreground">{impact.text}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		<p class="text-xs text-muted-foreground">
			Your edits will be saved in a new replan run and dependent steps will be re-sequenced.
		</p>

		<div class="flex justify-end gap-2 border-t border-border pt-4">
			<Button variant="outline" size="sm" label="Cancel" onclick={handleCancel} />
			<Button variant="primary" size="sm" label="Confirm & Rerun" onclick={handleConfirm} />
		</div>
	</div>
</Dialog>
