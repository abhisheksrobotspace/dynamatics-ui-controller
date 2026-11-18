<script lang="ts">
	import BBoxReviewer from './BBoxReviewer.svelte';
	import { resolvePageImageUrl } from '../lib/ocr.backend';
	import { translateBoxesPageToCrop } from '../lib/ocr-hole-images';
	import { cropPageRegionToObjectUrl } from '../lib/ocr-page-crop';
	import { saveHoleReview } from '../lib/ocr-hole-review';
	import { displaySketchMark, isNotFoundMark } from '../lib/ocr-mark-edit';
	import type { OcrResultRow, PdfJob } from '../lib/ocr.types';
	import { errorDescription } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast.js';
	import { Button, Dialog } from '@ifactory/ui-v2';

	export type HoleReviewSession = {
		row: OcrResultRow;
		pdf: PdfJob;
		rowId: string;
	};

	type ReviewCrop = {
		id: number;
		title: string;
		image: string;
		boxes: Array<{ x1: number; y1: number; x2: number; y2: number; class_id?: string }>;
	};

	type Props = {
		open: boolean;
		bomId: string;
		session: HoleReviewSession | null;
		pdfs: PdfJob[];
		onClose: () => void;
		onSave: (pdfs: PdfJob[]) => void;
	};

	let { open = $bindable(false), bomId, session, pdfs, onClose, onSave }: Props = $props();

	let reviewerRef = $state<{ save: () => void } | null>(null);
	let fullPageImageUrl = $state('');
	let reviewCrops = $state<ReviewCrop[]>([]);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let viewGeneration = 0;
	let blobUrlsToRevoke: string[] = [];

	const holeClasses = [
		{ id: 'hole', label: 'Operation', color: '#16A34A', activeColor: '#1D4ED8' }
	];

	const dialogTitle = $derived('Verify Operations');

	const dialogSubtitle = $derived(
		session
			? `Page ${session.row.page} · ${isNotFoundMark(session.row) ? 'No mark number' : displaySketchMark(session.row)}`
			: ''
	);

	function revokeBlobUrls() {
		for (const url of blobUrlsToRevoke) URL.revokeObjectURL(url);
		blobUrlsToRevoke = [];
	}

	function resetView() {
		fullPageImageUrl = '';
		reviewCrops = [];
		isLoading = false;
		revokeBlobUrls();
	}

	function handleOpenChange(next: boolean) {
		open = next;
		if (!next) {
			resetView();
			onClose();
		}
	}

	$effect(() => {
		if (!open || !session) {
			resetView();
			return;
		}

		const generation = ++viewGeneration;
		const row = session.row;
		const pdf = session.pdf;

		revokeBlobUrls();
		reviewCrops = [];
		fullPageImageUrl = '';
		isLoading = true;

		void (async () => {
			try {
				const pageUrl = await resolvePageImageUrl(bomId, pdf, row.page);
				if (generation !== viewGeneration) return;

				if (!pageUrl) {
					fullPageImageUrl = '';
					reviewCrops = [];
					return;
				}

				const crops = row.hole_images?.crops ?? [];
				const built: ReviewCrop[] = [];
				const created: string[] = [];
				for (const crop of crops) {
					if (!crop.box) continue;
					const objectUrl = await cropPageRegionToObjectUrl(pageUrl, crop.box);
					if (generation !== viewGeneration) {
						URL.revokeObjectURL(objectUrl);
						for (const u of created) URL.revokeObjectURL(u);
						return;
					}
					created.push(objectUrl);
					const relative = translateBoxesPageToCrop(crop.hole_boxes ?? [], crop.box);
					built.push({
						id: crop.part_idx,
						title: `Detected Part ${crop.part_idx}`,
						image: objectUrl,
						boxes: relative.map((box) => ({ ...box, class_id: 'hole' }))
					});
				}
				if (generation !== viewGeneration) {
					for (const u of created) URL.revokeObjectURL(u);
					return;
				}
				blobUrlsToRevoke = created;
				fullPageImageUrl = pageUrl;
				reviewCrops = built;
			} catch (error) {
				if (generation !== viewGeneration) return;
				fullPageImageUrl = '';
				reviewCrops = [];
				pmPushErrorToast({
					title: 'Could not load page image',
					description: errorDescription(error)
				});
			} finally {
				if (generation === viewGeneration) isLoading = false;
			}
		})();
	});

	async function handleReviewerSave(
		updatedCrops: Array<{
			id: number;
			title: string;
			image: string;
			boxes: Array<{ x1: number; y1: number; x2: number; y2: number; class_id?: string }>;
		}>
	) {
		if (!session || isSaving) return;
		isSaving = true;
		try {
			const next = await saveHoleReview(pdfs, session.rowId, updatedCrops);
			onSave(next);
			pmPushSuccessToast({ title: 'Operations saved' });
			handleOpenChange(false);
		} catch (error) {
			pmPushErrorToast({
				title: 'Could not save operations',
				description: errorDescription(error)
			});
		} finally {
			isSaving = false;
		}
	}
</script>

<Dialog
	bind:open
	title={dialogTitle}
	size="lg"
	hideFooter={true}
	onOpenChange={handleOpenChange}
	class="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-6xl"
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	{#if open && session}
		{#if dialogSubtitle}
			<p class="shrink-0 px-6 pb-2 text-sm text-muted-foreground">{dialogSubtitle}</p>
		{/if}

		<div class="flex min-h-[68vh] flex-1 flex-col overflow-hidden px-6 py-4">
			{#key session.rowId}
				<BBoxReviewer
					bind:this={reviewerRef}
					{fullPageImageUrl}
					crops={reviewCrops}
					classes={holeClasses}
					imageBaseUrl=""
					{isLoading}
					onSave={handleReviewerSave}
				/>
			{/key}
		</div>

		<div
			class="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-white px-6 py-4"
		>
			<Button variant="outline" label="Cancel" onclick={() => handleOpenChange(false)} />
			{#if !isLoading && reviewCrops.length > 0}
				<Button
					variant="primary"
					label="Save"
					onclick={() => reviewerRef?.save()}
					disabled={isSaving}
				/>
			{/if}
		</div>
	{/if}
</Dialog>
