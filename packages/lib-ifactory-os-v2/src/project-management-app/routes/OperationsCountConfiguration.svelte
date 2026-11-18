<script lang="ts">
	import { onMount } from 'svelte';
	import type { Project } from '../lib/store.svelte';
	import {
		getOperationsCountConfig,
		loadOperationsCountConfigurationPage,
		resolveOperationsCountContractorId,
		saveOperationsCountContractorSelection
	} from '../lib/projects/operations-count-config.api';
	import { fileDownloadUrl } from '../lib/core-api.js';
	import { Button, Combobox, EmptyState, Label, type ComboboxItem } from '@ifactory/ui-v2';
	import { pmPushErrorToast, pmPushSuccessToast, pmPushToast } from '../lib/toast';
	import { ChevronLeft, ChevronRight, FileImage, FolderOpen } from '@lucide/svelte';
	import PageSkeleton from '../components/PageSkeleton.svelte';
	import type { Contractor } from '../lib/projects/types';

	let { params } = $props();
	const projectId = $derived(params.projectId);

	let project = $state<Project | null>(null);
	let contractors = $state<Contractor[]>([]);
	let selectedContractorId = $state('');
	let sampleImageIndex = $state(0);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let loadError = $state<string | null>(null);

	const contractorComboboxItems = $derived(
		contractors.map((contractor): ComboboxItem => ({
			value: contractor.id,
			label: contractor.name
		}))
	);

	const selectedContractor = $derived(
		contractors.find((contractor) => contractor.id === selectedContractorId) ?? null
	);

	const selectedContractorName = $derived(selectedContractor?.name ?? '');

	const sampleImageIds = $derived(selectedContractor?.sampleMarkingsFileIds ?? []);

	const activeSampleImageId = $derived(sampleImageIds[sampleImageIndex] ?? null);

	const sampleImageCount = $derived(sampleImageIds.length);

	function selectContractor(value: string | string[]) {
		selectedContractorId = typeof value === 'string' ? value : (value[0] ?? '');
		sampleImageIndex = 0;
	}

	function showPreviousSampleImage() {
		if (sampleImageCount <= 1) return;
		sampleImageIndex = (sampleImageIndex - 1 + sampleImageCount) % sampleImageCount;
	}

	function showNextSampleImage() {
		if (sampleImageCount <= 1) return;
		sampleImageIndex = (sampleImageIndex + 1) % sampleImageCount;
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			loadError = null;
			try {
				const { project: loadedProject, contractors: loadedContractors } =
					await loadOperationsCountConfigurationPage(projectId, controller.signal);
				project = loadedProject;
				contractors = loadedContractors;
				if (!loadedProject) return;
				selectContractor(resolveOperationsCountContractorId(loadedProject));
			} catch (err) {
				loadError = err instanceof Error ? err.message : 'Failed to load OCR configuration';
			} finally {
				isLoading = false;
			}
		})();
		return () => controller.abort();
	});

	async function saveConfiguration() {
		if (!project || !selectedContractorId) return;
		isSaving = true;
		try {
			const config = await getOperationsCountConfig(selectedContractorId);
			if (!config.markNumberRegex.trim()) {
				pmPushToast({
					title: 'No mark number regex configured',
					description: `${selectedContractorName} does not have a mark number regex yet.`
				});
				return;
			}
			project = await saveOperationsCountContractorSelection(
				project,
				selectedContractorId,
				selectedContractorName
			);
			pmPushSuccessToast({
				title: 'Configuration saved',
				description: `Operations count will use ${selectedContractorName}'s mark number pattern.`
			});
			window.location.hash = `#/ProjectManagement/Home/${projectId}`;
		} catch (err) {
			pmPushErrorToast({
				title: 'Could not save configuration',
				description: err instanceof Error ? err.message : 'Save failed'
			});
		} finally {
			isSaving = false;
		}
	}
</script>

{#if isLoading}
	<PageSkeleton variant="form" />
{:else if project}
	<div class="space-y-4 p-4">
		<div
			class="flex flex-wrap items-center justify-between gap-3 border border-border bg-white px-4 py-3"
		>
			<div class="min-w-0">
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<FolderOpen class="size-3.5 shrink-0" aria-hidden="true" />
					<span>Project</span>
				</div>
				<p class="mt-1 truncate font-heading text-base font-semibold text-foreground">
					{project.projectName}
				</p>
			</div>
		</div>

		<div class="border border-border bg-white p-4">
			<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div class="min-w-0">
					<h2 class="font-heading text-base font-semibold text-foreground">OCR Settings</h2>
					<p class="mt-0.5 text-sm text-muted-foreground">
						Choose the contractor whose mark pattern this project uses for operations count.
					</p>
				</div>
				<Button
					variant="primary"
					label="Save Configuration"
					disabled={isSaving || !selectedContractorId}
					onclick={saveConfiguration}
				/>
			</div>

			{#if loadError}
				<p class="text-sm text-red-600">{loadError}</p>
			{:else}
				<div class="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
					<div class="flex w-full max-w-md flex-col gap-2 md:shrink-0">
						<Label for="operations-count-contractor" text="Contractor" required />
						{#if contractorComboboxItems.length > 0}
							<Combobox
								id="operations-count-contractor"
								placeholder="Select contractor"
								items={contractorComboboxItems}
								value={selectedContractorId}
								onValueChange={selectContractor}
							/>
						{:else}
							<p class="text-sm text-muted-foreground">No active contractors found.</p>
						{/if}
					</div>

					{#if selectedContractorId}
						<div class="min-w-0 flex-1">
							<p class="mb-2 text-sm font-medium text-foreground">Sample markings</p>
							{#if activeSampleImageId}
								<div class="flex flex-col items-center gap-2">
									<div
										class="flex h-48 w-full max-w-sm items-center justify-center border border-border bg-slate-50 p-2"
									>
										<img
											src={fileDownloadUrl(activeSampleImageId)}
											alt="Sample marking {sampleImageIndex +
												1} of {sampleImageCount} for {selectedContractorName}"
											class="max-h-full max-w-full object-contain"
										/>
									</div>
									<div class="flex items-center gap-2">
										<Button
											variant="outline"
											size="icon"
											icon={ChevronLeft}
											class="size-7"
											disabled={sampleImageCount <= 1}
											aria-label="Previous sample marking"
											onclick={showPreviousSampleImage}
										/>
										<span class="min-w-12 text-center text-xs text-muted-foreground">
											{sampleImageIndex + 1} / {sampleImageCount}
										</span>
										<Button
											variant="outline"
											size="icon"
											icon={ChevronRight}
											class="size-7"
											disabled={sampleImageCount <= 1}
											aria-label="Next sample marking"
											onclick={showNextSampleImage}
										/>
									</div>
								</div>
							{:else}
								<EmptyState
									icon={FileImage}
									title="No sample markings for this contractor"
									class="border border-border bg-slate-50 py-6"
								/>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<p class="px-4 text-gray-500">Project not found.</p>
{/if}
