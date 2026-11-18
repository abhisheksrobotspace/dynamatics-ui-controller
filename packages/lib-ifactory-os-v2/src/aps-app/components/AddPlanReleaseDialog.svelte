<script lang="ts">
	import { Alert, Button, Combobox, Dialog, Label, type ComboboxItem } from '@ifactory/ui-v2';
	import type { PlanProject, PlanRelease } from '../lib/create-plan.types.js';

	let {
		open = $bindable(false),
		projects,
		selectedReleaseIds,
		onAdd
	}: {
		open?: boolean;
		projects: PlanProject[];
		selectedReleaseIds: string[];
		onAdd: (release: PlanRelease) => void;
	} = $props();

	let selectedProjectId = $state('');
	let selectedReleaseId = $state('');
	let formError = $state('');

	const selectedReleaseIdSet = $derived(new Set(selectedReleaseIds));

	const availableProjects = $derived(
		projects.filter((project) =>
			project.releases.some(
				(release) => release.selectable && !selectedReleaseIdSet.has(release.id)
			)
		)
	);

	const projectItems = $derived(
		availableProjects.map((project): ComboboxItem => ({
			value: project.id,
			label: project.title,
			disabled: false
		}))
	);

	const releaseItems = $derived.by((): ComboboxItem[] => {
		if (!selectedProjectId) return [];
		const project = projects.find((entry) => entry.id === selectedProjectId);
		if (!project) return [];
		return project.releases
			.filter((release) => release.selectable && !selectedReleaseIdSet.has(release.id))
			.map((release) => ({
				value: release.id,
				label: release.label,
				disabled: !release.selectable
			}));
	});

	const releaseDisabled = $derived(!selectedProjectId || releaseItems.length === 0);

	function resetForm() {
		selectedProjectId = '';
		selectedReleaseId = '';
		formError = '';
	}

	function handleProjectChange(value: string | string[]) {
		const next = typeof value === 'string' ? value : value[0];
		selectedProjectId = next ?? '';
		selectedReleaseId = '';
		formError = '';
	}

	function handleReleaseChange(value: string | string[]) {
		const next = typeof value === 'string' ? value : value[0];
		selectedReleaseId = next ?? '';
		formError = '';
	}

	function handleConfirm() {
		formError = '';
		if (!selectedProjectId) {
			formError = 'Select a project.';
			return;
		}
		if (!selectedReleaseId) {
			formError = 'Select a production plan.';
			return;
		}

		const project = projects.find((entry) => entry.id === selectedProjectId);
		const release = project?.releases.find((entry) => entry.id === selectedReleaseId);
		if (!release || !release.selectable) {
			formError = 'Selected production plan is not available.';
			return;
		}

		onAdd(release);
		open = false;
		resetForm();
	}

	$effect(() => {
		if (!open) resetForm();
	});
</script>

<Dialog bind:open title="Add Production Plan" hideFooter={true}>
	<div class="space-y-4 pt-2 pb-4">
		{#if formError}
			<Alert variant="error" title="Could not add production plan" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="add-release-project" text="Project" required />
			<Combobox
				id="add-release-project"
				items={projectItems}
				bind:value={selectedProjectId}
				placeholder="Select project"
				emptyText="No projects with available production plans."
				onValueChange={handleProjectChange}
				triggerClass="rounded-none"
			/>
		</div>
		<div class="space-y-2">
			<Label for="add-release" text="Production plan" required />
			<Combobox
				id="add-release"
				items={releaseItems}
				bind:value={selectedReleaseId}
				placeholder={selectedProjectId ? 'Select production plan' : 'Select a project first'}
				emptyText="No confirmed production plans available."
				disabled={releaseDisabled}
				onValueChange={handleReleaseChange}
				triggerClass="rounded-none"
			/>
		</div>
	</div>

	<div class="flex items-center justify-end gap-3 border-t border-border pt-4">
		<Button variant="outline" label="Cancel" onclick={() => (open = false)} />
		<Button variant="primary" label="Add Production Plan" onclick={handleConfirm} />
	</div>
</Dialog>
