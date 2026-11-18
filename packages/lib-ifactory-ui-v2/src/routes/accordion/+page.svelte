<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Accordion, AccordionWithContent } from '$lib';
	import type { AccordionItem } from '$lib/components/ui/accordion';
	import type { AccordionWithContentItem } from '$lib/components/ui/accordion-with-content';

	const items: AccordionItem[] = [
		{
			value: 'what',
			title: 'What is Material Tailwind?',
			content:
				'Material Tailwind is a framework that enhances Tailwind CSS with additional styles and components.',
			defaultOpen: true
		},
		{
			value: 'how',
			title: 'How to use Material Tailwind?',
			content:
				'You can use Material Tailwind by importing its components into your Tailwind CSS project.'
		},
		{
			value: 'do',
			title: 'What can I do with Material Tailwind?',
			content:
				'Material Tailwind allows you to quickly build modern, responsive websites with a focus on design.'
		}
	];

	let multipleValue = $state<string[]>(['what']);
	let singleValue = $state('what');

	let contentItems = $state<AccordionWithContentItem[]>([
		{
			value: 'section-a',
			label: 'Section A',
			badge: '2 / 5',
			description: 'FLG 1-24 · THK 1-24',
			content:
				'Pass panel copy through the item.content field, the same way Accordion stores plain text content.'
		},
		{
			value: 'section-b',
			label: 'HT ANGLE 100×100×6',
			badge: '1 / 3',
			description: '6,000–12,000 mm · pitch 500 · from Rule 2',
			defaultOpen: true,
			checkboxes: [{ value: 6000 }, { value: 6100 }, { value: 6200 }],
			selectedCheckboxValues: [6000]
		}
	]);

	let contentValue = $state<string[]>(['section-b']);

	function handleCheckboxChange(itemValue: string, optionValue: number, checked: boolean) {
		const item = contentItems.find((entry) => entry.value === itemValue);
		if (!item) return;

		const current = item.selectedCheckboxValues ?? [];
		item.selectedCheckboxValues = checked
			? current.includes(optionValue)
				? current
				: [...current, optionValue]
			: current.filter((value) => value !== optionValue);
		const selectedCount = item.selectedCheckboxValues.length;
		item.badge = `${selectedCount} / ${item.checkboxes?.length ?? 0}`;
		contentItems = [...contentItems];
	}

	function handleCheckboxSelectAll(itemValue: string) {
		const item = contentItems.find((entry) => entry.value === itemValue);
		if (!item?.checkboxes?.length) return;

		item.selectedCheckboxValues = item.checkboxes.map((option) => option.value);
		item.badge = `${item.selectedCheckboxValues.length} / ${item.checkboxes.length}`;
		contentItems = [...contentItems];
	}

	function handleCheckboxDeselectAll(itemValue: string) {
		const item = contentItems.find((entry) => entry.value === itemValue);
		if (!item) return;

		item.selectedCheckboxValues = [];
		item.badge = `0 / ${item.checkboxes?.length ?? 0}`;
		contentItems = [...contentItems];
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Accordion</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Expandable sections with animated height transitions. Supports single and multiple open
			panels.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Multiple</h2>
		<p class="text-sm text-muted-foreground">
			Open panels: {multipleValue.length > 0 ? multipleValue.join(', ') : 'none'}
		</p>
		<div class="max-w-2xl border-t border-border bg-surface">
			<Accordion {items} type="multiple" bind:value={multipleValue} />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Single</h2>
		<p class="text-sm text-muted-foreground">Open panel: {singleValue || 'none'}</p>
		<div class="max-w-2xl border-t border-border bg-surface">
			<Accordion {items} type="single" bind:value={singleValue} collapsible />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With content</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Data-driven accordion with optional badge, description, plain text content, or checkbox grids.
			Pass everything on items — no snippet slots.
		</p>
		<AccordionWithContent
			items={contentItems}
			type="multiple"
			bind:value={contentValue}
			onCheckboxChange={handleCheckboxChange}
			onCheckboxSelectAll={handleCheckboxSelectAll}
			onCheckboxDeselectAll={handleCheckboxDeselectAll}
		/>
	</section>
</div>
