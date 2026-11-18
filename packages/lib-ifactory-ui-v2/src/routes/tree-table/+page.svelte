<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import {
		Input,
		Label,
		Toggle,
		TreeTable,
		type TreeTableColumn,
		type TreeTableColumnDef,
		type TreeTableNode
	} from '$lib';

	type PartRow = {
		crossSection?: string;
		rmId?: string;
		rmLength?: string;
		qty?: string;
		holes?: string;
		process?: string;
		hasDxf?: boolean;
	};

	const nodes: TreeTableNode<PartRow>[] = [
		{
			id: 'j1055',
			label: 'J1055 Pune Transmission',
			children: [
				{
					id: 'ht-200',
					label: 'HT ANGLE 200×200×22',
					children: [
						{
							id: 'rm-a22-001',
							label: 'RM-A22-001',
							children: [
								{
									id: 'len-7-8',
									label: '7.8 m',
									children: [
										{
											id: 'group-1',
											label: 'Group 1',
											children: [
												{
													id: 'part-71h',
													label: 'J55 DA 71H',
													data: {
														rmLength: 'L: 2.4 m',
														qty: '2',
														holes: '4',
														process: 'Drill+Cope',
														hasDxf: true
													}
												},
												{
													id: 'part-72h',
													label: 'J55 DA 72H',
													data: {
														rmLength: 'L: 1.8 m',
														qty: '1',
														holes: '2',
														process: 'Drill',
														hasDxf: true
													}
												},
												{
													id: 'part-73h',
													label: 'J55 DA 73H',
													data: {
														rmLength: 'L: 3.6 m',
														qty: '1',
														holes: '6',
														process: 'Cope',
														hasDxf: true
													}
												}
											]
										}
									]
								}
							]
						},
						{
							id: 'rm-a22-002',
							label: 'RM-A22-002',
							children: [
								{
									id: 'len-6-0',
									label: '6.0 m',
									children: [
										{
											id: 'group-2',
											label: 'Group 1',
											children: [
												{
													id: 'part-81a',
													label: 'J55 DB 81A',
													data: {
														rmLength: 'L: 2.0 m',
														qty: '3',
														holes: '2',
														process: 'Drill',
														hasDxf: true
													}
												}
											]
										}
									]
								}
							]
						}
					]
				},
				{
					id: 'ms-150',
					label: 'MS PLATE 150×12',
					children: [
						{
							id: 'rm-p12-010',
							label: 'RM-P12-010',
							children: [
								{
									id: 'len-2-5',
									label: '2.5 m',
									children: [
										{
											id: 'group-3',
											label: 'Group 1',
											children: [
												{
													id: 'part-plate-1',
													label: 'PL-01',
													data: {
														rmLength: 'L: 2.5 m',
														qty: '4',
														holes: '8',
														process: 'Punch',
														hasDxf: true
													}
												}
											]
										}
									]
								}
							]
						}
					]
				}
			]
		}
	];

	const columns: TreeTableColumn<PartRow>[] = [
		{
			key: 'name',
			header: 'Name / ID',
			tree: true,
			class: 'min-w-[18rem]'
		},
		{
			key: 'crossSection',
			header: 'Cross-Section',
			value: (node) => node.data?.crossSection ?? ''
		},
		{
			key: 'rmId',
			header: 'RM ID',
			value: (node) => node.data?.rmId ?? ''
		},
		{
			key: 'rmLength',
			header: 'RM Length',
			value: (node) => node.data?.rmLength ?? ''
		},
		{
			key: 'qty',
			header: 'Qty',
			value: (node) => node.data?.qty ?? ''
		},
		{
			key: 'holes',
			header: 'Holes',
			value: (node) => node.data?.holes ?? ''
		},
		{
			key: 'process',
			header: 'Process',
			value: (node) => node.data?.process ?? ''
		},
		{
			type: 'actions',
			key: 'dxf',
			header: 'DXF',
			actions: (node) =>
				node.data?.hasDxf
					? [
							{
								label: 'Download DXF',
								variant: 'outline',
								size: 'sm',
								class: 'border-primary text-primary hover:bg-primary/5',
								onClick: () => {
									lastAction = `Download DXF for ${node.label}`;
								}
							}
						]
					: []
		}
	];

	type ScheduleRow = {
		workOrder?: string;
		structure?: string;
		sets?: string;
		weight?: string;
	};

	const scheduleNodes: TreeTableNode<ScheduleRow>[] = [
		{
			id: 'proj-j1055',
			kind: 'group',
			label: 'J1055 - Reliance Industries - 400 kV D/C Quad Moose Transmission Line Package',
			children: [
				{
					id: 'da-basic',
					label: 'J1055',
					defaultExpanded: true,
					data: {
						workOrder: 'J1055',
						structure: 'DA - Basic Tower',
						sets: '24',
						weight: '412.18'
					},
					details: [
						'HT ANGLE 200×200×22 — 2 RM bars — 1,010.24 kg',
						'MS ANGLE 75×75×5 — 20 RM bars — 653.50 kg',
						'MS PLATE 150×12 — 8 plates — 248.00 kg'
					]
				},
				{
					id: 'stub-da',
					label: 'J1055',
					data: {
						workOrder: 'J1055',
						structure: 'Stub & Cleats - DA',
						sets: '9',
						weight: '103.59'
					}
				},
				{
					id: 'footer-j1055',
					kind: 'group-footer',
					label: '33 sets · 515.77 MT'
				}
			]
		},
		{
			id: 'proj-j1054',
			kind: 'group',
			label: 'J1054 - Adani Energy - 765 kV D/C Transmission Line',
			children: [
				{
					id: 'db-basic',
					label: 'J1054',
					data: {
						workOrder: 'J1054',
						structure: 'DB - Basic Tower',
						sets: '18',
						weight: '288.40'
					},
					details: ['HT ANGLE 150×150×18 — 4 RM bars — 820.00 kg']
				},
				{
					id: 'footer-j1054',
					kind: 'group-footer',
					label: '18 sets · 288.40 MT'
				}
			]
		}
	];

	const scheduleColumns: TreeTableColumn<ScheduleRow>[] = [
		{
			key: 'workOrder',
			header: 'Work Order',
			tree: true,
			value: (node) => node.data?.workOrder ?? node.label,
			class: 'min-w-[8rem]'
		},
		{
			key: 'structure',
			header: 'Structure',
			value: (node) => node.data?.structure ?? '',
			class: 'min-w-[14rem]'
		},
		{
			key: 'sets',
			header: 'Sets',
			value: (node) => node.data?.sets ?? ''
		},
		{
			key: 'weight',
			header: 'Weight (MT)',
			value: (node) => node.data?.weight ?? ''
		}
	];

	let filterQuery = $state('');
	let scheduleFilterQuery = $state('');
	let lastAction = $state<string | null>(null);
	let loading = $state(true);

	type ReleaseEditRow = {
		unit?: string;
		alreadyReleased?: string;
		thisRelease?: string;
		editable?: boolean;
	};

	let releaseEditValues = $state<Record<string, string>>({
		'bom-basic-body': '1',
		'bom-basic-body-2': '1',
		'bom-hb': '2'
	});

	const releaseEditNodes: TreeTableNode<ReleaseEditRow>[] = [
		{
			id: 'tower-ha',
			label: 'HA',
			defaultExpanded: true,
			children: [
				{
					id: 'section-basic',
					label: 'Basic Body',
					defaultExpanded: true,
					children: [
						{
							id: 'bom-basic-body',
							label: 'Basic Body',
							data: {
								unit: 'Set',
								alreadyReleased: '2',
								editable: true
							}
						},
						{
							id: 'bom-basic-body-2',
							label: 'Basic Body 2',
							data: {
								unit: 'Set',
								alreadyReleased: '2',
								editable: true
							}
						}
					]
				},
				{
					id: 'section-hb',
					label: 'HB',
					defaultExpanded: true,
					children: [
						{
							id: 'bom-hb',
							label: 'HB',
							data: {
								unit: 'Set',
								alreadyReleased: '-',
								editable: true
							}
						}
					]
				}
			]
		}
	];

	const releaseEditColumns: TreeTableColumn<ReleaseEditRow>[] = [
		{
			key: 'name',
			header: '',
			tree: true,
			class: 'min-w-[16rem]'
		},
		{
			key: 'unit',
			header: 'Unit',
			class: 'text-muted-foreground',
			value: (node) => node.data?.unit ?? ''
		},
		{
			key: 'alreadyReleased',
			header: 'Already Released',
			headerClass: 'text-center',
			class: 'text-center',
			value: (node) => node.data?.alreadyReleased ?? ''
		},
		{
			type: 'input',
			key: 'thisRelease',
			header: 'This Release',
			headerClass: 'text-center',
			align: 'center',
			inputType: 'number',
			min: 0,
			step: 1,
			visible: (node) => Boolean(node.data?.editable),
			value: (node) => releaseEditValues[node.id] ?? '',
			onValueChange: (node, value) => {
				releaseEditValues = { ...releaseEditValues, [node.id]: value };
			}
		}
	];

	type ScheduleEditDateKey = 'd19' | 'd26';

	type ScheduleEditRow = {
		unit?: string;
		unitWt?: number;
		editable?: boolean;
	};

	let scheduleEditQty = $state<Record<string, Record<ScheduleEditDateKey, string>>>({
		'edit-bom-basic': { d19: '4', d26: '2' },
		'edit-bom-hb': { d19: '1', d26: '0' }
	});

	function isScheduleEditLeaf(node: TreeTableNode<ScheduleEditRow>): boolean {
		return Boolean(node.data?.editable);
	}

	function scheduleQty(nodeId: string, dateKey: ScheduleEditDateKey): string {
		return scheduleEditQty[nodeId]?.[dateKey] ?? '';
	}

	function setScheduleQty(nodeId: string, dateKey: ScheduleEditDateKey, value: string) {
		const current = scheduleEditQty[nodeId] ?? { d19: '', d26: '' };
		scheduleEditQty = {
			...scheduleEditQty,
			[nodeId]: { ...current, [dateKey]: value }
		};
	}

	function scheduleWeight(
		node: TreeTableNode<ScheduleEditRow>,
		dateKey: ScheduleEditDateKey
	): string {
		if (!isScheduleEditLeaf(node)) return '';
		const qty = Number(scheduleQty(node.id, dateKey));
		const unitWt = node.data?.unitWt;
		if (!Number.isFinite(qty) || qty <= 0 || unitWt == null || unitWt <= 0) return '-';
		return (qty * unitWt).toFixed(2);
	}

	function editableDateColumns(
		dateKey: ScheduleEditDateKey,
		autofocusFirst = false
	): TreeTableColumnDef<ScheduleEditRow>[] {
		return [
			{
				type: 'input',
				key: `${dateKey}-qty`,
				header: 'Qty (SET)',
				headerClass: 'text-center',
				align: 'center',
				inputType: 'number',
				min: 0,
				step: 1,
				autofocusFirst,
				visible: isScheduleEditLeaf,
				value: (node) => scheduleQty(node.id, dateKey),
				onValueChange: (node, value) => setScheduleQty(node.id, dateKey, value)
			},
			{
				key: `${dateKey}-wt`,
				header: 'Weight (MT)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => scheduleWeight(node, dateKey)
			}
		];
	}

	const scheduleEditNodes: TreeTableNode<ScheduleEditRow>[] = [
		{
			id: 'edit-tower-ha',
			label: 'HA',
			defaultExpanded: true,
			children: [
				{
					id: 'edit-bom-basic',
					label: 'Basic Body',
					data: { unit: 'Set', unitWt: 0.525, editable: true }
				},
				{
					id: 'edit-bom-hb',
					label: 'HB',
					data: { unit: 'Set', unitWt: 0.48, editable: true }
				}
			]
		}
	];

	const scheduleEditColumns = $derived.by((): TreeTableColumnDef<ScheduleEditRow>[] => {
		void scheduleEditQty;
		return [
			{
				key: 'name',
				header: '',
				tree: true,
				class: 'min-w-[16rem]'
			},
			{
				key: 'unit',
				header: 'Unit',
				class: 'text-muted-foreground',
				value: (node) => node.data?.unit ?? ''
			},
			{
				key: 'q1',
				header: 'Q1 FY27',
				headerClass: 'text-center',
				columns: [
					{
						key: 'd19',
						header: '19/08/2026',
						headerClass: 'text-center',
						columns: editableDateColumns('d19', true)
					},
					{
						key: 'd26',
						header: '26/08/2026',
						headerClass: 'text-center',
						columns: editableDateColumns('d26')
					}
				]
			}
		];
	});

	type DeliveryRow = {
		unit?: string;
		released?: string;
		qty19?: string;
		wt19?: string;
		qty26?: string;
		wt26?: string;
		qtyOct?: string;
		wtOct?: string;
	};

	function qtyWtColumns(
		key: string,
		qtyField: keyof DeliveryRow,
		wtField: keyof DeliveryRow
	): TreeTableColumnDef<DeliveryRow>[] {
		return [
			{
				key: `${key}-qty`,
				header: 'Qty (SET)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.[qtyField] ?? ''
			},
			{
				key: `${key}-wt`,
				header: 'Weight (MT)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.[wtField] ?? ''
			}
		];
	}

	const deliveryNodes: TreeTableNode<DeliveryRow>[] = [
		{
			id: 'tower-ha',
			label: 'HA',
			defaultExpanded: true,
			children: [
				{
					id: 'bom-basic',
					label: 'Basic Body',
					data: {
						unit: 'Set',
						released: '6',
						qty19: '4',
						wt19: '2.10',
						qty26: '2',
						wt26: '1.05',
						qtyOct: '1',
						wtOct: '0.52'
					}
				},
				{
					id: 'bom-hb',
					label: 'HB',
					data: {
						unit: 'Set',
						released: '1',
						qty19: '1',
						wt19: '0.48',
						qty26: '-',
						wt26: '-',
						qtyOct: '2',
						wtOct: '0.96'
					}
				}
			]
		}
	];

	const deliveryColumns: TreeTableColumnDef<DeliveryRow>[] = [
		{
			key: 'name',
			header: '',
			tree: true,
			class: 'min-w-[16rem]'
		},
		{
			key: 'd19',
			header: '19/08/2026',
			headerClass: 'text-center',
			columns: qtyWtColumns('d19', 'qty19', 'wt19')
		},
		{
			key: 'd26',
			header: '26/08/2026',
			headerClass: 'text-center',
			columns: qtyWtColumns('d26', 'qty26', 'wt26')
		}
	];

	const twoLevelColumns: TreeTableColumnDef<DeliveryRow>[] = [
		{
			key: 'name',
			header: '',
			tree: true,
			class: 'min-w-[16rem]'
		},
		{
			key: 'q1',
			header: 'Q1 FY27',
			headerClass: 'text-center',
			columns: [
				{
					key: 'aug',
					header: '19/08/2026',
					headerClass: 'text-center',
					columns: qtyWtColumns('aug', 'qty19', 'wt19')
				},
				{
					key: 'sep',
					header: '26/08/2026',
					headerClass: 'text-center',
					columns: qtyWtColumns('sep', 'qty26', 'wt26')
				}
			]
		}
	];

	const threeLevelColumns: TreeTableColumnDef<DeliveryRow>[] = [
		{
			key: 'name',
			header: '',
			tree: true,
			class: 'min-w-[16rem]'
		},
		{
			key: 'fy',
			header: 'FY 2026-27',
			headerClass: 'text-center',
			columns: [
				{
					key: 'q1',
					header: 'Q1',
					headerClass: 'text-center',
					columns: [
						{
							key: 'aug',
							header: 'Aug',
							headerClass: 'text-center',
							columns: qtyWtColumns('aug', 'qty19', 'wt19')
						},
						{
							key: 'sep',
							header: 'Sep',
							headerClass: 'text-center',
							columns: qtyWtColumns('sep', 'qty26', 'wt26')
						}
					]
				},
				{
					key: 'q2',
					header: 'Q2',
					headerClass: 'text-center',
					columns: [
						{
							key: 'oct',
							header: 'Oct',
							headerClass: 'text-center',
							columns: qtyWtColumns('oct', 'qtyOct', 'wtOct')
						}
					]
				}
			]
		}
	];

	const mixedDepthColumns: TreeTableColumnDef<DeliveryRow>[] = [
		{
			key: 'name',
			header: '',
			tree: true,
			class: 'min-w-[16rem]'
		},
		{
			key: 'released',
			header: 'Released',
			headerClass: 'text-center',
			class: 'text-center',
			value: (node) => node.data?.released ?? ''
		},
		{
			key: 'planned',
			header: 'Planned',
			headerClass: 'text-center',
			columns: [
				{
					key: 'q1',
					header: 'Q1',
					headerClass: 'text-center',
					columns: qtyWtColumns('q1', 'qty19', 'wt19')
				},
				{
					key: 'q2',
					header: 'Q2',
					headerClass: 'text-center',
					columns: qtyWtColumns('q2', 'qtyOct', 'wtOct')
				}
			]
		}
	];
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-10 p-8">
	<section class="space-y-4">
		<h2 class="text-xl font-semibold">TreeTable</h2>
		<p class="text-sm text-muted-foreground">
			Hierarchical expandable rows with a dedicated tree column, optional filter, and per-row
			actions (e.g. Download DXF).
		</p>

		<Input
			type="search"
			placeholder="Filter by mark, work order, cross-section..."
			bind:value={filterQuery}
			aria-label="Filter tree table"
		/>

		{#if lastAction}
			<p class="text-sm text-muted-foreground">Last action: {lastAction}</p>
		{/if}

		<TreeTable {nodes} {columns} {filterQuery} defaultExpandAll={false} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Loading skeleton</h2>
		<p class="text-sm text-muted-foreground">
			Set <code class="text-xs">loading</code> to keep headers. Parent rows indent with expand chevrons
			and empty measure cells; leaf rows get value placeholders (and a DXF button shape).
		</p>
		<div class="flex items-center gap-3">
			<Toggle id="tree-table-loading" bind:checked={loading} aria-label="Tree table loading" />
			<Label for="tree-table-loading" text="Show loading skeleton" />
		</div>
		<TreeTable {nodes} {columns} {loading} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Editable input column</h2>
		<p class="text-sm text-muted-foreground">
			Use <code class="text-xs">type: 'input'</code> for controlled cell inputs. Press Enter to move
			to the next editable input in the same column. Parent rows omit the input via
			<code class="text-xs">visible</code>.
		</p>

		<TreeTable nodes={releaseEditNodes} columns={releaseEditColumns} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Editable input columns with grouped headers</h2>
		<p class="text-sm text-muted-foreground">
			<code class="text-xs">type: 'input'</code> works on grouped leaf columns. Enter still moves down
			the same date’s Qty column. Weight is derived from Qty × unit weight and is read-only.
		</p>

		<TreeTable nodes={scheduleEditNodes} columns={scheduleEditColumns} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With group headers, details, and footers</h2>
		<p class="text-sm text-muted-foreground">
			Use <code class="text-xs">kind: 'group'</code> / <code class="text-xs">group-footer</code>,
			<code class="text-xs">details</code> for section lines under a work-order entry (expand on
			Work Order; Structure is the tower name only),
			<code class="text-xs">defaultExpandLevels</code> for initial depth, and
			<code class="text-xs">footer</code> for a grand total.
		</p>

		<Input
			type="search"
			placeholder="Filter schedule rows..."
			bind:value={scheduleFilterQuery}
			aria-label="Filter schedule tree table"
		/>

		<TreeTable
			nodes={scheduleNodes}
			columns={scheduleColumns}
			filterQuery={scheduleFilterQuery}
			footer="51 sets · 804.17 MT"
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Grouped column headers</h2>
		<p class="text-sm text-muted-foreground">
			One-level groups: nest leaf columns under a parent with <code class="text-xs">columns</code>.
			Ungrouped columns span the extra header row. Use this for a date over Qty and Weight.
		</p>

		<TreeTable nodes={deliveryNodes} columns={deliveryColumns} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Two-level column groups</h2>
		<p class="text-sm text-muted-foreground">
			Groups may contain other groups. Quarter spans dates; each date spans Qty and Weight.
		</p>

		<TreeTable nodes={deliveryNodes} columns={twoLevelColumns} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Three-level column groups</h2>
		<p class="text-sm text-muted-foreground">
			FY → quarter → month → Qty / Weight. Sibling groups at the same level can have different
			widths (Q1 has two months, Q2 has one).
		</p>

		<TreeTable nodes={deliveryNodes} columns={threeLevelColumns} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Mixed-depth column groups</h2>
		<p class="text-sm text-muted-foreground">
			A leaf such as Released sits beside a nested Planned group. The leaf rowspans the remaining
			header rows so Qty / Weight still line up.
		</p>

		<TreeTable nodes={deliveryNodes} columns={mixedDepthColumns} />
	</section>
</div>
