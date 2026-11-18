<script lang="ts">
	import { Download, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import type { ScheduleJobDetail } from './production-schedule.constants';

	type Props = {
		open?: boolean;
		job?: ScheduleJobDetail | null;
		onClose?: () => void;
		onAction?: () => void;
		class?: string;
	};

	let { open = false, job = null, onClose, onAction, class: className = '' }: Props = $props();
</script>

<aside
	class={[
		'flex h-full shrink-0 flex-col overflow-hidden bg-background',
		open ? 'w-80' : 'w-0',
		className
	]}
>
	{#if open && job}
		<div class="flex items-start justify-between border-b border-border px-4 py-3">
			<div class="flex min-w-0 items-center gap-2">
				<span class="size-2.5 shrink-0" style:background-color={job.color}></span>
				<h3 class="truncate text-base font-bold text-foreground" title={job.title}>{job.title}</h3>
			</div>
			<Button
				variant="ghost"
				size="icon"
				icon={X}
				class="size-8 shrink-0"
				aria-label="Close details panel"
				onclick={onClose}
			/>
		</div>

		<div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
			{#each job.sections as section (section.title)}
				<section>
					<p class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
						{section.title}
					</p>
					<div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
						{#each section.fields as field (field.label)}
							{@const valueText = String(field.value)}
							<span class="shrink-0 text-muted-foreground">{field.label}</span>
							<span
								class="min-w-0 truncate text-right font-medium text-foreground"
								title={valueText}>{valueText}</span
							>
						{/each}
					</div>
				</section>
			{/each}

			{#if job.actionLabel}
				<section>
					<p class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
						Parts
					</p>
					<Button
						variant="outline"
						size="sm"
						label={job.actionLabel}
						icon={Download}
						class="w-full border-primary text-primary hover:bg-primary/5"
						onclick={onAction}
					/>
				</section>
			{/if}
		</div>
	{/if}
</aside>
