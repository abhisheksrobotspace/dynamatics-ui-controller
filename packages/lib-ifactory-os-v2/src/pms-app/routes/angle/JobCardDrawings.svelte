<script lang="ts">
	import { HmiFlatButton, ImageViewer, type ImageViewerItem } from '@ifactory/ui-v2';
	import { X } from '@lucide/svelte';
	import { drawingStatusCopy } from '../../lib/drawing-files.js';
	import { DrawingFileSession, watchDrawings } from '../../lib/drawing-file-session.svelte.js';
	import { drawingViewStartIndex } from '../../lib/drawing-view.js';
	import { pmsStore } from '../../lib/hmi-store.svelte';
	import type { AppNavigation } from '../../lib/navigation';
	import { jobCardPanelFromCard } from '../../lib/job-card-display.js';

	let { navigation }: { navigation: AppNavigation } = $props();

	const files = new DrawingFileSession();
	let brokenIds = $state<string[]>([]);
	const startIndex = drawingViewStartIndex();

	const card = $derived.by(() => {
		const jobId = pmsStore.activeJob?.jobId;
		if (!jobId) return undefined;
		return pmsStore.jobs[jobId]?.sourceCard;
	});
	const panel = $derived(jobCardPanelFromCard(card));
	const selected = $derived(panel.drawings[startIndex] ?? panel.drawings[0]);
	const selectedState = $derived(selected ? files.notices[selected.dest] : undefined);
	const selectedCopy = $derived(
		selected
			? drawingStatusCopy({
					expired: selected.expired,
					hasFile: Boolean(selected.dest),
					status: selectedState?.status,
					error: selectedState?.error,
					broken: brokenIds.includes(selected.id)
				})
			: null
	);
	const readyItems = $derived<ImageViewerItem[]>(
		panel.drawings
			.filter((drawing) => {
				if (!drawing.src || drawing.expired || brokenIds.includes(drawing.id)) return false;
				return files.notices[drawing.dest]?.status === 'ready';
			})
			.map((drawing) => ({
				id: drawing.id,
				src: drawing.src,
				alt: drawing.markNo || '-',
				label: drawing.markNo || '-'
			}))
	);

	function markBroken(item: ImageViewerItem): void {
		const id = item.id;
		if (!id || brokenIds.includes(id)) return;
		brokenIds = [...brokenIds, id];
	}
</script>

<div
	class="flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-white pt-2 pr-7 pb-4 pl-[30px] font-body text-[#1b2028]"
	{@attach watchDrawings(files, card, panel.drawings, startIndex)}
>
	{#if !pmsStore.activeJob}
		{@render closeRow()}
		{@render message('No job is running', 'Drawings open for the job on this machine.')}
	{:else if panel.drawings.length === 0}
		{@render closeRow()}
		{@render message('No drawings on this job card')}
	{:else if selectedCopy}
		{@render closeRow()}
		{@render message(selectedCopy)}
	{:else}
		<ImageViewer
			bind:index={files.viewerIndex}
			items={readyItems}
			onError={markBroken}
			onClose={() => navigation.goBack()}
			variant="hmi"
			class="min-h-0 flex-1"
		/>
	{/if}
</div>

<!-- The viewer carries its own close key; the empty states need one too. -->
{#snippet closeRow()}
	<div class="flex shrink-0 justify-end">
		<HmiFlatButton
			icon={X}
			size="xs"
			class="w-[72px]"
			iconClass="size-8"
			aria-label="Close"
			onclick={() => navigation.goBack()}
		/>
	</div>
{/snippet}

{#snippet message(title: string, detail?: string)}
	<div
		class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-[#c3c8cf]"
	>
		<p class="m-0 text-[28px] leading-9 font-bold first-letter:uppercase">{title}</p>
		{#if detail}
			<p class="m-0 font-heading text-xl font-medium text-[#5a616c]">{detail}</p>
		{/if}
	</div>
{/snippet}
