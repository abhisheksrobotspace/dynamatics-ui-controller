<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Combobox } from '$lib';
	import type { ComboboxItem } from '$lib/components/ui/combobox';

	const assignees: ComboboxItem[] = [
		{ label: 'Leslie Alexander', value: 'leslie-alexander' },
		{ label: 'Michael Foster', value: 'michael-foster' },
		{ label: 'Dries Vincent', value: 'dries-vincent' },
		{ label: 'Lindsay Walton', value: 'lindsay-walton' },
		{ label: 'Courtney Henry', value: 'courtney-henry' },
		{ label: 'Tom Cook', value: 'tom-cook' },
		{ label: 'Whitney Francis', value: 'whitney-francis' },
		{ label: 'Leonard Krasner', value: 'leonard-krasner' },
		{ label: 'Floyd Miles', value: 'floyd-miles' },
		{ label: 'Emily Selman', value: 'emily-selman' },
		{ label: 'Kristin Watson', value: 'kristin-watson' },
		{ label: 'Emma Dorsey', value: 'emma-dorsey' },
		{ label: 'Alicia Bell', value: 'alicia-bell' },
		{ label: 'Jenny Wilson', value: 'jenny-wilson' },
		{ label: 'Anna Roberts', value: 'anna-roberts' },
		{ label: 'Benjamin Russel', value: 'benjamin-russel' },
		{ label: 'Jeffrey Webb', value: 'jeffrey-webb' },
		{ label: 'Kathryn Murphy', value: 'kathryn-murphy' },
		{ label: 'Lawrence Hunter', value: 'lawrence-hunter' },
		{ label: 'Yvette Armstrong', value: 'yvette-armstrong' },
		{ label: 'Angela Fisher', value: 'angela-fisher' },
		{ label: 'Blake Reid', value: 'blake-reid' },
		{ label: 'Hector Gibbons', value: 'hector-gibbons' },
		{ label: 'Fabricio Mendes', value: 'fabricio-mendes' },
		{ label: 'Jillian Steward', value: 'jillian-steward' },
		{ label: 'Chelsea Hagon', value: 'chelsea-hagon' }
	];

	const tags: ComboboxItem[] = [
		{ label: 'Maintenance', value: 'maintenance' },
		{ label: 'Production', value: 'production' },
		{ label: 'Quality', value: 'quality' },
		{ label: 'Safety', value: 'safety' },
		{ label: 'Inventory', value: 'inventory' },
		{ label: 'Energy', value: 'energy' },
		{ label: 'Environment', value: 'environment' },
		{ label: 'Management', value: 'management' },
		{ label: 'Human Resources', value: 'human-resources' },
		{ label: 'Information Technology', value: 'information-technology' },
		{ label: 'Finance', value: 'finance' },
		{ label: 'Marketing', value: 'marketing' },
		{ label: 'Sales', value: 'sales' },
		{ label: 'Customer Service', value: 'customer-service' },
		{ label: 'Legal', value: 'legal' },
		{ label: 'Other', value: 'other' }
	];

	let assignedTo = $state('');
	let selectedTags = $state<string[]>([]);
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Combobox</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Button trigger with in-panel search, keyboard navigation, and optional multi-select.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Simple</h2>
		<p class="text-sm text-muted-foreground">Assigned to: {assignedTo || 'None'}</p>
		<div class="max-w-md rounded-lg border border-border bg-surface p-6">
			<Combobox
				items={assignees}
				bind:value={assignedTo}
				label="Assigned to"
				placeholder="Select assignee..."
				searchPlaceholder="Search assignee..."
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Multi-select</h2>
		<p class="text-sm text-muted-foreground">
			Selected tags: {selectedTags.length > 0 ? selectedTags.join(', ') : 'None'}
		</p>
		<div class="max-w-md rounded-lg border border-border bg-surface p-6">
			<Combobox
				items={tags}
				bind:value={selectedTags}
				multiple
				label="Tags"
				placeholder="Select tags..."
				searchPlaceholder="Search tags..."
			/>
		</div>
	</section>
</div>
