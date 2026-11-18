<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import {
		Button,
		Checkbox,
		Combobox,
		Dialog,
		Input,
		Label,
		type ComboboxItem
	} from '@ifactory/ui-v2';
	import type { LengthGroup } from '../../project-management-app/lib/store.svelte.js';
	import { baseNamesWithGroup, formatLengthRange } from '../lib/cutting-plan/length-groups';
	import type { SectionData } from '../lib/cutting-plan/types';

	export type LengthGroupMembershipUpdate = {
		groupId: string;
		baseNames: string[];
	};

	interface Props {
		open?: boolean;
		groups: LengthGroup[];
		/** Live section list (may already be grouped). */
		sections: SectionData[];
		/** Called with every group the user edited while the dialog was open. */
		onApply?: (updates: LengthGroupMembershipUpdate[]) => void;
	}

	let { open = $bindable(false), groups, sections, onApply }: Props = $props();

	let selectedGroupId = $state('');
	let selectedBaseNames = $state<string[]>([]);
	/** Draft checkbox state per group while the dialog stays open. */
	let draftByGroupId = $state<Record<string, string[]>>({});
	let wasOpen = $state(false);
	let lastGroupId = $state('');
	let sectionSearchQuery = $state('');

	const groupItems = $derived(
		groups.map((group): ComboboxItem => ({
			label: `${group.name} (${formatLengthRange(group.minLength, group.maxLength)} mm)`,
			value: group.id
		}))
	);

	const baseSectionOptions = $derived.by(() => {
		const seen = new SvelteSet<string>();
		for (const section of sections) {
			seen.add(section.baseName ?? section.name);
		}
		return [...seen].sort((a, b) => a.localeCompare(b));
	});

	const filteredSectionOptions = $derived.by(() => {
		const query = sectionSearchQuery.trim().toLowerCase();
		if (!query) return baseSectionOptions;
		return baseSectionOptions.filter((name) => name.toLowerCase().includes(query));
	});

	function selectionForGroup(groupId: string): string[] {
		if (Object.hasOwn(draftByGroupId, groupId)) {
			return [...draftByGroupId[groupId]];
		}
		const group = groups.find((entry) => entry.id === groupId);
		return group ? baseNamesWithGroup(sections, group.name) : [];
	}

	function persistCurrentDraft() {
		if (!lastGroupId) return;
		draftByGroupId = { ...draftByGroupId, [lastGroupId]: [...selectedBaseNames] };
	}

	function switchToGroup(groupId: string) {
		persistCurrentDraft();
		selectedGroupId = groupId;
		selectedBaseNames = selectionForGroup(groupId);
		lastGroupId = groupId;
	}

	$effect(() => {
		if (open && !wasOpen) {
			draftByGroupId = {};
			const initialId = groups[0]?.id ?? '';
			selectedGroupId = initialId;
			selectedBaseNames = selectionForGroup(initialId);
			lastGroupId = initialId;
			sectionSearchQuery = '';
		}
		if (!open && wasOpen) {
			draftByGroupId = {};
			lastGroupId = '';
		}
		wasOpen = open;
	});

	$effect(() => {
		if (!open || !selectedGroupId) return;
		if (selectedGroupId === lastGroupId) return;
		switchToGroup(selectedGroupId);
	});

	function toggleBaseName(name: string, checked: boolean) {
		if (checked) {
			if (!selectedBaseNames.includes(name)) {
				selectedBaseNames = [...selectedBaseNames, name];
			}
		} else {
			selectedBaseNames = selectedBaseNames.filter((entry) => entry !== name);
		}
		if (selectedGroupId) {
			draftByGroupId = { ...draftByGroupId, [selectedGroupId]: [...selectedBaseNames] };
		}
	}

	function selectAllSections() {
		selectedBaseNames = [...baseSectionOptions];
		if (selectedGroupId) {
			draftByGroupId = { ...draftByGroupId, [selectedGroupId]: [...selectedBaseNames] };
		}
	}

	function clearSections() {
		selectedBaseNames = [];
		if (selectedGroupId) {
			draftByGroupId = { ...draftByGroupId, [selectedGroupId]: [] };
		}
	}

	function handleApply() {
		persistCurrentDraft();
		const updates = [...groups]
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.filter((group) => Object.hasOwn(draftByGroupId, group.id))
			.map((group) => ({
				groupId: group.id,
				baseNames: [...(draftByGroupId[group.id] ?? [])]
			}));
		if (updates.length === 0) return;
		onApply?.(updates);
		open = false;
	}

	function handleCancel() {
		open = false;
	}
</script>

<Dialog
	bind:open
	title="Group sections"
	size="sm"
	hideFooter
	class="flex max-h-[90vh] flex-col overflow-hidden"
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
		<div class="space-y-2">
			<Label for="apply-group" text="Group" required />
			{#if groupItems.length > 0}
				<Combobox
					id="apply-group"
					placeholder="Select group"
					items={groupItems}
					bind:value={selectedGroupId}
				/>
			{:else}
				<p class="text-sm text-muted-foreground">No length groups configured.</p>
			{/if}
		</div>

		<div class="space-y-2">
			{#if baseSectionOptions.length > 0}
				<div class="flex items-center gap-2">
					<Input
						id="apply-group-section-search"
						placeholder="Search sections…"
						bind:value={sectionSearchQuery}
						class="flex-1"
					/>
					<Button
						variant="outline"
						size="sm"
						label="Include all"
						class="shrink-0"
						onclick={selectAllSections}
					/>
					<Button
						variant="outline"
						size="sm"
						label="Exclude all"
						class="shrink-0"
						onclick={clearSections}
					/>
				</div>
			{/if}
			{#if baseSectionOptions.length === 0}
				<p class="text-sm text-muted-foreground">No sections available.</p>
			{:else if filteredSectionOptions.length === 0}
				<p class="text-sm text-muted-foreground">No sections match.</p>
			{:else}
				<ul class="max-h-64 space-y-2 overflow-y-auto border border-border p-3">
					{#each filteredSectionOptions as name (name)}
						<li class="flex items-center gap-3">
							<Checkbox
								checked={selectedBaseNames.includes(name)}
								onCheckedChange={(checked) => toggleBaseName(name, checked)}
								aria-label={`Include section ${name} in group`}
							/>
							<span class="text-sm text-foreground">{name}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<div class="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-white px-6 py-4">
		<Button variant="outline" label="Cancel" class="w-full" onclick={handleCancel} />
		<Button
			variant="primary"
			label="Apply"
			class="w-full"
			disabled={!selectedGroupId}
			onclick={handleApply}
		/>
	</div>
</Dialog>
