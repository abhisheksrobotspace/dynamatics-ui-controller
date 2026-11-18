<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Plus } from '@lucide/svelte';
	import { AccordionWithTable } from '$lib';
	import type { AccordionWithTableItem } from '$lib/components/ui/accordion-with-table';
	import {
		AccordionHierarchyWithTable,
		type AccordionHierarchyItem
	} from '$lib/components/ui/accordion-hierarchy-with-table';
	import type { DataTableColumn } from '$lib/components/ui/table';

	type OrderRow = {
		key: string;
		order: string;
		page: string;
		rmLen: string;
		group: string;
		markNo: string;
		htMs: string;
		section: string;
		width: string;
		partLen: string;
		unitWt: string;
		wtPc: string;
		pcs: string;
		weight: string;
		holes: string;
		process: string;
		rmId: string;
	};

	const columns: DataTableColumn<OrderRow>[] = [
		{ key: 'order', header: 'ORDER', value: (row) => row.order },
		{ key: 'page', header: 'PAGE', value: (row) => row.page },
		{ key: 'rmLen', header: 'RM LEN (M)', value: (row) => row.rmLen },
		{ key: 'group', header: 'GROUP', value: (row) => row.group },
		{
			key: 'markNo',
			header: 'MARK NO',
			value: (row) => row.markNo
		},
		{ key: 'htMs', header: 'HT/MS', value: (row) => row.htMs },
		{ key: 'section', header: 'SECTION', value: (row) => row.section },
		{ key: 'width', header: 'WIDTH', value: (row) => row.width },
		{ key: 'partLen', header: 'PART LEN', value: (row) => row.partLen },
		{ key: 'unitWt', header: 'UNIT WT', value: (row) => row.unitWt },
		{ key: 'wtPc', header: 'WT/PC (KG)', value: (row) => row.wtPc },
		{ key: 'pcs', header: 'PCS', value: (row) => row.pcs },
		{ key: 'weight', header: 'WEIGHT (KG)', value: (row) => row.weight },
		{ key: 'holes', header: 'HOLES', value: (row) => row.holes },
		{
			key: 'process',
			header: 'PROCESS',
			type: 'badge',
			badge: (row) => ({ variant: 'outline', label: row.process })
		},
		{ key: 'rmId', header: 'RM ID', value: (row) => row.rmId }
	];

	const t57Rows: OrderRow[] = [
		{
			key: 't57-1',
			order: 'T57',
			page: '1',
			rmLen: '12.0',
			group: 'A',
			markNo: 'T57 DA 71H',
			htMs: 'HT',
			section: 'W14',
			width: '140',
			partLen: '3200',
			unitWt: '42.5',
			wtPc: '18.2',
			pcs: '4',
			weight: '72.8',
			holes: '6',
			process: 'CPD',
			rmId: 'RM-1042'
		},
		{
			key: 't57-2',
			order: 'T57',
			page: '1',
			rmLen: '12.0',
			group: 'A',
			markNo: 'T57 DA 72H',
			htMs: 'MS',
			section: 'W14',
			width: '140',
			partLen: '2800',
			unitWt: '38.0',
			wtPc: '16.4',
			pcs: '3',
			weight: '49.2',
			holes: '4',
			process: 'CPDH',
			rmId: 'RM-1043'
		},
		{
			key: 't57-3',
			order: 'T57',
			page: '2',
			rmLen: '10.5',
			group: 'B',
			markNo: 'T57 DB 11H',
			htMs: 'HT',
			section: 'W12',
			width: '120',
			partLen: '2400',
			unitWt: '31.2',
			wtPc: '12.8',
			pcs: '5',
			weight: '64.0',
			holes: '—',
			process: 'CPSN',
			rmId: 'RM-1044'
		},
		{
			key: 't57-4',
			order: 'T57',
			page: '2',
			rmLen: '10.5',
			group: 'B',
			markNo: 'T57 DB 12H',
			htMs: 'MS',
			section: 'W12',
			width: '120',
			partLen: '2100',
			unitWt: '28.4',
			wtPc: '11.5',
			pcs: '2',
			weight: '23.0',
			holes: '2',
			process: 'CPD',
			rmId: 'RM-1045'
		},
		{
			key: 't57-5',
			order: 'T57',
			page: '3',
			rmLen: '9.8',
			group: 'C',
			markNo: 'T57 DC 05H',
			htMs: 'HT',
			section: 'W10',
			width: '100',
			partLen: '1800',
			unitWt: '22.1',
			wtPc: '9.4',
			pcs: '6',
			weight: '56.4',
			holes: '3',
			process: 'CPDH',
			rmId: 'RM-1046'
		},
		{
			key: 't57-6',
			order: 'T57',
			page: '3',
			rmLen: '9.8',
			group: 'C',
			markNo: 'T57 DC 06H',
			htMs: 'MS',
			section: 'W10',
			width: '100',
			partLen: '1600',
			unitWt: '19.8',
			wtPc: '8.1',
			pcs: '4',
			weight: '32.4',
			holes: '—',
			process: 'CPSN',
			rmId: 'RM-1047'
		}
	];

	const t17Rows: OrderRow[] = t57Rows.map((row) => ({
		...row,
		key: row.key.replace('t57', 't17'),
		order: 'T17'
	}));

	const items: AccordionWithTableItem<OrderRow>[] = [
		{
			value: 't17',
			label: 'Order T17',
			rows: t17Rows,
			rowCount: 907
		},
		{
			value: 't57',
			label: 'Order T57',
			rows: t57Rows,
			rowCount: 907,
			defaultOpen: true
		}
	];

	const summaryItems: AccordionWithTableItem<OrderRow>[] = [
		{
			value: 'angle-120',
			label: 'MS ANGLE 120x120x9',
			description: '120×120×9',
			stats: [
				{ label: 'Stock lengths', value: '7600 / 7475 mm' },
				{ label: 'Bars', value: '6' },
				{ label: 'Weight', value: '752.0 kg' },
				{
					label: 'Waste',
					value: '1.31%',
					sublabel: '9.9 kg',
					badgeVariant: 'online'
				}
			],
			progress: {
				label: 'Utilisation',
				value: 99,
				valueLabel: '99% used',
				fillTone: 'online',
				remainderTone: 'error'
			},
			rows: t57Rows.slice(0, 2),
			rowCount: 2
		},
		{
			value: 'plate-16',
			label: 'MS PLATE 16',
			description: '16 mm',
			stats: [
				{ label: 'Stock lengths', value: '6000 mm' },
				{ label: 'Bars', value: '1' },
				{ label: 'Weight', value: '77.9 kg' },
				{
					label: 'Waste',
					value: '43.40%',
					sublabel: '33.8 kg',
					badgeVariant: 'error'
				}
			],
			progress: {
				label: 'Utilisation',
				value: 57,
				valueLabel: '57% used',
				fillTone: 'online',
				remainderTone: 'error'
			},
			rows: t17Rows.slice(0, 1),
			rowCount: 1
		}
	];

	const sharedSummaryHeadings = {
		section: 'Section',
		stats: ['Stock lengths', 'Bars', 'Weight', 'Waste'],
		progress: 'Utilisation'
	};

	const angleStats = summaryItems[0].stats!;
	const plateStats = summaryItems[1].stats!;

	/** Finding 1: one row omits `progress` while headings still include Utilisation. */
	const missingProgressItems: AccordionWithTableItem<OrderRow>[] = [
		{
			value: 'bug-progress-present',
			label: 'MS ANGLE 120x120x9',
			description: '120×120×9',
			stats: angleStats,
			progress: summaryItems[0].progress,
			rows: t57Rows.slice(0, 2),
			rowCount: 2
		},
		{
			value: 'bug-progress-missing',
			label: 'MS PLATE 16 (no progress field)',
			description: '16 mm',
			stats: plateStats,
			rows: t17Rows.slice(0, 1),
			rowCount: 1
		}
	];

	/** Finding 2: section-only headings still suppress per-item stat labels. */
	const partialHeadingsItems: AccordionWithTableItem<OrderRow>[] = [
		{
			value: 'bug-partial-angle',
			label: 'MS ANGLE 120x120x9',
			description: '120×120×9',
			stats: angleStats,
			progress: summaryItems[0].progress,
			rows: t57Rows.slice(0, 1),
			rowCount: 1
		},
		{
			value: 'bug-partial-plate',
			label: 'MS PLATE 16',
			description: '16 mm',
			stats: plateStats,
			rows: t17Rows.slice(0, 1),
			rowCount: 1
		}
	];

	/** Finding 4: long label makes shared `min-w-[12rem]` heading constraint visible. */
	const hierarchyBugItems: AccordionHierarchyItem<OrderRow>[] = [
		{
			value: 'bug-hierarchy-long',
			label:
				'Very long hierarchy section title that demonstrates min-w-[12rem] on accordionHierarchyTriggerHeadingClass',
			description: 'Shared heading class re-exported from accordion-with-table',
			groups: [
				{
					value: 'bug-hierarchy-group',
					label: 'Nested group',
					tables: [{ title: 'Sample rows', rows: t57Rows.slice(0, 2) }],
					defaultOpen: true
				}
			],
			defaultOpen: true
		}
	];

	let openPanels = $state<string[]>(['t57']);
	let minimalOpenPanel = $state('t57');
	let selectedOrderKeys = $state<string[]>([]);
	let summaryOpenPanels = $state<string[]>([]);
	let bugMissingProgressOpen = $state<string[]>([]);
	let bugPartialHeadingsOpen = $state<string[]>([]);
	let bugHeaderOrderOpen = $state<string[]>([]);
	let bugHeaderOrderSelected = $state<string[]>([]);
	let bugHierarchyOpen = $state<string[]>(['bug-hierarchy-long']);
	let bugHierarchyGroups = $state<Record<string, string[]>>({
		'bug-hierarchy-long': ['bug-hierarchy-group']
	});
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Accordion With Table</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Expandable order panels that reveal a data table using the shared DataTable component.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With toolbar</h2>
		<p class="text-sm text-muted-foreground">
			Open panels: {openPanels.length > 0 ? openPanels.join(', ') : 'none'}
		</p>
		<AccordionWithTable
			{items}
			{columns}
			rowKey={(row) => row.key}
			type="multiple"
			bind:value={openPanels}
			maxVisibleRows={6}
			search={{ enabled: true, placeholder: 'Search rows...' }}
			export={{ enabled: true, fileName: 'orders' }}
			toolbarButton={{
				enabled: true,
				label: 'Add row',
				icon: Plus,
				onClick: () => {}
			}}
			pagination={{ enabled: true, pageSize: 5 }}
			triggerTitleClass="font-medium"
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Table only</h2>
		<p class="text-sm text-muted-foreground">
			Search, export, toolbar action, and pagination disabled.
		</p>
		<AccordionWithTable
			{items}
			{columns}
			rowKey={(row) => row.key}
			type="single"
			bind:value={minimalOpenPanel}
			collapsible
			search={{ enabled: false }}
			export={{ enabled: false }}
			toolbarButton={{ enabled: false, label: 'Add row' }}
			pagination={{ enabled: false }}
			sorting={{ enabled: false }}
			triggerTitleClass="font-medium"
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With selection</h2>
		<p class="text-sm text-muted-foreground">
			Select rows using the Checkbox column. Selected rows: {selectedOrderKeys.length}
		</p>
		<AccordionWithTable
			{items}
			{columns}
			rowKey={(row) => row.key}
			type="multiple"
			bind:value={openPanels}
			selection={{ enabled: true }}
			bind:selectedRowKeys={selectedOrderKeys}
			search={{ enabled: false }}
			export={{ enabled: false }}
			pagination={{ enabled: false }}
			triggerTitleClass="font-medium"
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With stats + utilisation progress</h2>
		<p class="text-sm text-muted-foreground">
			Rich trigger with caller-provided stat headings and an optional progress bar heading.
		</p>
		<AccordionWithTable
			items={summaryItems}
			{columns}
			rowKey={(row) => row.key}
			type="multiple"
			bind:value={summaryOpenPanels}
			headings={{
				section: 'Section',
				stats: ['Stock lengths', 'Bars', 'Weight', 'Waste'],
				progress: 'Utilisation'
			}}
			search={{ enabled: false }}
			export={{ enabled: false }}
			pagination={{ enabled: false }}
			sorting={{ enabled: false }}
			triggerTitleClass="font-medium"
		/>
	</section>

	<section class="space-y-8">
		<div class="space-y-2">
			<h2 class="text-xl font-semibold">Bugbot findings (repro)</h2>
			<p class="max-w-2xl text-sm text-muted-foreground">
				These examples deliberately reproduce known Bugbot findings — they are not the desired UX.
				Open <code class="text-xs">/accordion-with-table</code> and inspect each subsection below.
			</p>
		</div>

		<div class="space-y-4">
			<h3 class="text-lg font-medium">1. Medium — Missing progress column placeholder (fixed)</h3>
			<p class="text-sm text-muted-foreground">
				Expected: header shows Utilisation; the row without
				<code class="text-xs">progress</code> keeps an empty Utilisation cell so columns stay aligned.
			</p>
			<AccordionWithTable
				items={missingProgressItems}
				{columns}
				rowKey={(row) => row.key}
				type="multiple"
				bind:value={bugMissingProgressOpen}
				headings={sharedSummaryHeadings}
				search={{ enabled: false }}
				export={{ enabled: false }}
				pagination={{ enabled: false }}
				sorting={{ enabled: false }}
				triggerTitleClass="font-medium"
			/>
		</div>

		<div class="space-y-4">
			<h3 class="text-lg font-medium">2. Medium — Partial headings hide stat labels</h3>
			<p class="text-sm text-muted-foreground">
				Expected: per-item stat labels disappear with
				<code class="text-xs">headings.section</code> only; Waste still aligns across rows because
				an empty progress slot is reserved when any sibling has
				<code class="text-xs">progress</code>.
			</p>
			<AccordionWithTable
				items={partialHeadingsItems}
				{columns}
				rowKey={(row) => row.key}
				type="multiple"
				bind:value={bugPartialHeadingsOpen}
				headings={{ section: 'Section' }}
				search={{ enabled: false }}
				export={{ enabled: false }}
				pagination={{ enabled: false }}
				sorting={{ enabled: false }}
				triggerTitleClass="font-medium"
			/>
		</div>

		<div class="space-y-4">
			<h3 class="text-lg font-medium">3. Medium — Header row column order mismatch</h3>
			<p class="text-sm text-muted-foreground">
				Expected: header spacer columns don't line up with item trigger checkboxes/chevron when
				shared headings combine with <code class="text-xs">selection</code>.
			</p>
			<AccordionWithTable
				items={summaryItems}
				{columns}
				rowKey={(row) => row.key}
				type="multiple"
				bind:value={bugHeaderOrderOpen}
				headings={sharedSummaryHeadings}
				selection={{ enabled: true }}
				bind:selectedRowKeys={bugHeaderOrderSelected}
				search={{ enabled: false }}
				export={{ enabled: false }}
				pagination={{ enabled: false }}
				sorting={{ enabled: false }}
				triggerTitleClass="font-medium"
			/>
		</div>

		<div class="space-y-4">
			<h3 class="text-lg font-medium">4. Low — Shared heading min-width regression</h3>
			<p class="text-sm text-muted-foreground">
				Expected: long section title makes
				<code class="text-xs">min-w-[12rem]</code> on
				<code class="text-xs">accordionHierarchyTriggerHeadingClass</code> visible as a layout constraint.
			</p>
			<AccordionHierarchyWithTable
				items={hierarchyBugItems}
				{columns}
				rowKey={(row) => row.key}
				type="multiple"
				bind:value={bugHierarchyOpen}
				bind:openGroupValues={bugHierarchyGroups}
				search={{ enabled: false }}
				pagination={{ enabled: false }}
				sorting={{ enabled: false }}
				triggerTitleClass="font-medium"
			/>
		</div>
	</section>
</div>
