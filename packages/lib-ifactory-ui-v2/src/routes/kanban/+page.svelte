<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Kanban, type KanbanColumn, type KanbanItem, type KanbanItemMoveDetail } from '$lib';

	const columns: KanbanColumn[] = [
		{ id: 'planned', title: 'Planned', actionLabel: 'Create' },
		{ id: 'assigned', title: 'Assigned' },
		{ id: 'in-progress', title: 'In Progress' },
		{ id: 'completed', title: 'Completed' }
	];

	let items = $state<KanbanItem[]>([
		{
			id: 'job-101',
			columnId: 'planned',
			title: 'Shaft machining — Lot A',
			badge: '120 pcs',
			metaBadge: '16 Sep',
			fields: [
				{ label: 'Job Id', value: 'JOB-101' },
				{ label: 'Machine', value: 'CNC-01' }
			]
		},
		{
			id: 'job-102',
			columnId: 'planned',
			title: 'Housing bore — Lot B',
			badge: '48 pcs',
			metaBadge: '17 Sep',
			fields: [
				{ label: 'Job Id', value: 'JOB-102' },
				{ label: 'Machine', value: 'CNC-03' }
			]
		},
		{
			id: 'job-201',
			columnId: 'assigned',
			title: 'Flange facing — Lot C',
			badge: '64 pcs',
			metaBadge: '15 Sep',
			fields: [
				{ label: 'Job Id', value: 'JOB-201' },
				{ label: 'Machine', value: 'LATHE-02' }
			]
		},
		{
			id: 'job-301',
			columnId: 'in-progress',
			title: 'Gear blank — Lot D',
			badge: '30 pcs',
			metaBadge: '16 Sep',
			fields: [
				{ label: 'Job Id', value: 'JOB-301' },
				{ label: 'Machine', value: 'CNC-02' }
			]
		},
		{
			id: 'job-302',
			columnId: 'in-progress',
			title: 'Bracket drill — Lot E',
			badge: '90 pcs',
			metaBadge: '16 Sep',
			fields: [
				{ label: 'Job Id', value: 'JOB-302' },
				{ label: 'Machine', value: 'DRILL-01' }
			]
		},
		{
			id: 'job-401',
			columnId: 'completed',
			title: 'Pin turn — Lot F',
			badge: '200 pcs',
			metaBadge: '14 Sep',
			fields: [
				{ label: 'Job Id', value: 'JOB-401' },
				{ label: 'Machine', value: 'LATHE-01' }
			]
		}
	]);

	let lastMove = $state<string>('No moves yet');
	let createCount = $state(0);

	function handleItemMove(detail: KanbanItemMoveDetail) {
		lastMove = `Moved ${detail.itemId}: ${detail.fromColumnId} → ${detail.toColumnId} @ ${detail.toIndex}`;
	}

	function handleColumnAction(column: KanbanColumn) {
		if (column.id !== 'planned') return;
		createCount += 1;
		const id = `job-new-${createCount}`;
		items = [
			...items,
			{
				id,
				columnId: 'planned',
				title: `New job ${createCount}`,
				badge: '10 pcs',
				metaBadge: 'Today',
				fields: [
					{ label: 'Job Id', value: `JOB-N${createCount}` },
					{ label: 'Machine', value: 'TBD' }
				]
			}
		];
		console.log('Created item', id);
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-6 p-8">
	<section class="space-y-2">
		<h1 class="text-2xl font-semibold">Kanban</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Drag cards within or across columns. Use Create on Planned to add a card. Bind
			<code class="text-xs">items</code>
			and listen to
			<code class="text-xs">onItemMove</code>
			for persistence.
		</p>
		<p class="text-sm text-muted-foreground">{lastMove}</p>
	</section>

	<section class="h-[32rem]">
		<Kanban {columns} bind:items onItemMove={handleItemMove} onColumnAction={handleColumnAction} />
	</section>
</div>
