<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Pencil } from '@lucide/svelte';
	import { DataTable, Table } from '$lib';
	import type { DataTableColumn } from '$lib/components/ui/table';

	type GroupedRow = {
		key: string;
		kind: 'section' | 'rm' | 'part';
		section?: string;
		rmLength?: string;
		rmId?: string;
		partMarkNo?: string;
		startTime?: string;
		endTime?: string;
	};

	const groupedRows: GroupedRow[] = [
		{ key: 'section-1', kind: 'section', section: 'HT ANGLE 100×100×6' },
		{
			key: 'section-1-rm-1',
			kind: 'rm',
			rmLength: '11.5 m',
			rmId: 'T17-1-HT ANGLE 100×100×6-11.5-2'
		},
		{
			key: 'section-1-part-1',
			kind: 'part',
			partMarkNo: 'T17 DA 659H',
			startTime: '04/08 13:16',
			endTime: '04/08 13:25'
		},
		{
			key: 'section-1-rm-2',
			kind: 'rm',
			rmLength: '11.5 m',
			rmId: 'T57-1-HT ANGLE 100×100×6-11.5-2'
		},
		{
			key: 'section-1-part-2',
			kind: 'part',
			partMarkNo: 'T57 DA 659H',
			startTime: '04/08 00:28',
			endTime: '04/08 00:37'
		},
		{ key: 'section-2', kind: 'section', section: 'HT ANGLE 100×100×7' },
		{
			key: 'section-2-rm-1',
			kind: 'rm',
			rmLength: '11.1 m',
			rmId: 'T17-2-HT ANGLE 100×100×7-11.1-1.1'
		},
		{
			key: 'section-2-part-1',
			kind: 'part',
			partMarkNo: 'T17 DA 957H',
			startTime: '04/08 12:07',
			endTime: '04/08 12:15'
		},
		{
			key: 'section-2-part-2',
			kind: 'part',
			partMarkNo: 'T17 DA 958H',
			startTime: '04/08 12:36',
			endTime: '04/08 12:45'
		}
	];

	const groupedColumns: DataTableColumn<GroupedRow>[] = [
		{
			key: 'section',
			header: 'SECTION',
			value: (row) => (row.kind === 'section' ? (row.section ?? '') : '')
		},
		{
			key: 'rmLength',
			header: 'RM LENGTH',
			headerClass: 'text-right',
			class: 'text-right',
			value: (row) => (row.kind === 'rm' ? (row.rmLength ?? '') : '')
		},
		{
			key: 'rmId',
			header: 'RM ID',
			value: (row) => (row.kind === 'rm' ? (row.rmId ?? '') : '')
		},
		{
			key: 'partMarkNo',
			header: 'PART MARK NUMBER',
			class: 'font-semibold',
			value: (row) => (row.kind === 'part' ? (row.partMarkNo ?? '') : '')
		},
		{
			key: 'startTime',
			header: 'START TIME',
			value: (row) => (row.kind === 'part' ? (row.startTime ?? '') : '')
		},
		{
			key: 'endTime',
			header: 'END TIME',
			value: (row) => (row.kind === 'part' ? (row.endTime ?? '') : '')
		}
	];

	type TreeRow = {
		key: string;
		kind: 'parent' | 'child';
		depth: number;
		bold?: boolean;
		sr?: string;
		description: string;
		unit?: string;
		alreadyReleased: string;
		thisRelease: string;
	};

	const treeRows: TreeRow[] = [
		{
			key: '1',
			kind: 'parent',
			depth: 0,
			bold: true,
			sr: '1',
			description: 'dd',
			alreadyReleased: '—',
			thisRelease: '1'
		},
		{
			key: '1-1',
			kind: 'child',
			depth: 1,
			description: 'Basic Body + Basic Level Plan',
			unit: 'Set',
			alreadyReleased: '—',
			thisRelease: '1'
		},
		{
			key: '1-2',
			kind: 'child',
			depth: 1,
			description: 'Basic Body',
			unit: 'Set',
			alreadyReleased: '—',
			thisRelease: '1'
		},
		{
			key: '2',
			kind: 'parent',
			depth: 0,
			bold: true,
			sr: '2',
			description: 'ha',
			alreadyReleased: '—',
			thisRelease: '0'
		},
		{
			key: '2-1',
			kind: 'child',
			depth: 1,
			bold: true,
			description: 'Total Towers',
			alreadyReleased: '—',
			thisRelease: '1'
		}
	];

	const treeColumns: DataTableColumn<TreeRow>[] = [
		{
			key: 'sr',
			header: 'Sr.',
			class: 'w-16',
			value: (row) => (row.kind === 'parent' ? (row.sr ?? '') : '')
		},
		{
			key: 'description',
			header: 'Description',
			class: 'whitespace-pre min-w-[16rem]',
			value: (row) => `${'    '.repeat(row.depth)}${row.description}`
		},
		{
			key: 'unit',
			header: 'Unit',
			class: 'text-muted-foreground',
			value: (row) => row.unit ?? ''
		},
		{
			key: 'alreadyReleased',
			header: 'Already Released',
			headerClass: 'text-center',
			class: 'text-center',
			value: (row) => row.alreadyReleased
		},
		{
			key: 'thisRelease',
			header: 'This Release',
			headerClass: 'text-center',
			class: 'text-center',
			value: (row) => row.thisRelease
		},
		{
			key: 'actions',
			header: 'Actions',
			type: 'actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: (row) =>
				row.kind === 'parent'
					? [
							{
								label: 'Edit',
								variant: 'outline',
								size: 'sm',
								icon: Pencil,
								onClick: () => {}
							}
						]
					: []
		}
	];
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Table patterns</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Experimental table layouts using Table and DataTable. Delete this route when no longer needed.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Grouped sparse table</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Section, RM, and part rows flattened into one table — empty cells are left blank per row type.
		</p>
		<div class="space-y-6">
			<div class="space-y-2">
				<h3 class="text-sm font-medium text-muted-foreground">Table</h3>
				<div class="border border-border bg-surface">
					<Table
						columns={groupedColumns}
						rows={groupedRows}
						rowKey={(row) => row.key}
						layout="content"
						variant="plain"
						rowClass={(row) => (row.kind === 'section' ? 'font-semibold' : '')}
					/>
				</div>
			</div>
			<div class="space-y-2">
				<h3 class="text-sm font-medium text-muted-foreground">DataTable</h3>
				<DataTable
					columns={groupedColumns}
					rows={groupedRows}
					rowKey={(row) => row.key}
					search={{ enabled: false }}
					export={{ enabled: false }}
					pagination={{ enabled: false }}
					sorting={{ enabled: false }}
					rowClass={(row) => (row.kind === 'section' ? 'font-semibold' : '')}
				/>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Tree table</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Parent and child rows flattened into one table — indentation via spaced description values,
			parent highlight via rowClass. Actions column returns buttons only for parent rows.
		</p>
		<div class="space-y-6">
			<div class="space-y-2">
				<h3 class="text-sm font-medium text-muted-foreground">Table</h3>
				<Table
					columns={treeColumns}
					rows={treeRows}
					rowKey={(row) => row.key}
					variant="structured"
					layout="shell"
					rowClass={(row) =>
						row.kind === 'parent' ? 'font-semibold' : row.bold ? 'font-semibold' : ''}
				/>
			</div>
			<div class="space-y-2">
				<h3 class="text-sm font-medium text-muted-foreground">DataTable</h3>
				<DataTable
					columns={treeColumns}
					rows={treeRows}
					rowKey={(row) => row.key}
					search={{ enabled: false }}
					export={{ enabled: false }}
					pagination={{ enabled: false }}
					sorting={{ enabled: false }}
					rowClass={(row) =>
						row.kind === 'parent' ? 'bg-primary/5 font-semibold' : row.bold ? 'font-semibold' : ''}
				/>
			</div>
		</div>
	</section>
</div>
