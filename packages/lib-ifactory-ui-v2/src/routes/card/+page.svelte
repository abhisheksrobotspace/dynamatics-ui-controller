<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import {
		ExtruderCard,
		FilterCard,
		FilterCardStrip,
		DetailsCard,
		HmiMachineCard,
		KeyValueCard,
		KpiCardStrip,
		ReasonCard,
		StatusMetricCard,
		type KpiCardItem
	} from '$lib/components/ui/card';
	import {
		Brush,
		CalendarX,
		ClipboardCheck,
		ClipboardList,
		Copy,
		FileText,
		FolderOpen,
		HardHat,
		Hash,
		List,
		Route,
		SearchX,
		Tag,
		TriangleAlert
	} from '@lucide/svelte';

	let activeFilter = $state('matched');

	/** Sample Extruder 100 — 10 zones with mixed green / yellow / red deltas. */
	const extruder100Actual = [176, 188, 195, 182, 170, 205, 190, 178, 200, 165];
	const extruder100Set = [180, 185, 190, 185, 188, 192, 190, 185, 188, 180];

	const filterCards = [
		{ id: 'all', label: 'Total', count: 128, icon: List, clickable: false },
		{ id: 'matched', label: 'Matched', count: 96, icon: ClipboardCheck },
		{ id: 'duplicate', label: 'Duplicate', count: 12, icon: Copy },
		{ id: 'not-found', label: 'Unable to detect', count: 8, icon: SearchX },
		{ id: 'missing', label: 'Sketches Missing', count: 12, icon: TriangleAlert }
	];

	/** 2-col job / part summary (default). */
	const partDetails = [
		{ label: 'Planned Plates', value: '20' },
		{ label: 'Thickness', value: '12 mm' },
		{ label: 'Part Size', value: '450 × 320 mm' },
		{ label: 'Operations', value: 'Punch · Drill · Mark' }
	];

	/** 2 fields — compact summary without a caption. */
	const sessionDetails = [
		{ label: 'Operator', value: '0192 - Shivam' },
		{ label: 'Shift', value: 'A · Day' }
	];

	/** Single field — still uses the panel shell. */
	const singleField = [{ label: 'Batch ID', value: 'BDL-014' }];

	/** Odd count — last cell left empty in a 2-col grid. */
	const oddCountDetails = [
		{ label: 'Section', value: 'J1055-M121' },
		{ label: 'RM ID', value: 'TA4195DA1007' },
		{ label: 'Start', value: '02 Sep 2026' }
	];

	/** 3-col machine / asset snapshot. */
	const machineDetails = [
		{ label: 'Asset', value: 'PL-01' },
		{ label: 'Status', value: 'Idle' },
		{ label: 'Last Job', value: 'J1055' },
		{ label: 'Uptime', value: '04:12:08' },
		{ label: 'Cycle', value: '42 s' },
		{ label: 'Line', value: 'Bay 3' }
	];

	/** 4-col work-order strip. */
	const orderDetails = [
		{ label: 'WO', value: 'RS-101' },
		{ label: 'Customer', value: 'Reliance' },
		{ label: 'Priority', value: 'High' },
		{ label: 'Due', value: '02 Sep' }
	];

	/** Inventory / stock snapshot. */
	const stockDetails = [
		{ label: 'On Hand', value: '1,240 kg' },
		{ label: 'Reserved', value: '320 kg' },
		{ label: 'Free', value: '920 kg' },
		{ label: 'Location', value: 'WH-A / R12' }
	];

	/** Device / console fleet fields. */
	const deviceDetails = [
		{ label: 'DID', value: 'aa:bb:cc:dd:ee:ff' },
		{ label: 'Firmware', value: '2.4.1' },
		{ label: 'Last Seen', value: '2 min ago' },
		{ label: 'Cert', value: 'Valid' },
		{ label: 'Tenant', value: 'acme-mfg' },
		{ label: 'Model', value: 'RS-Console' }
	];

	/** Long values — truncation / wrap behavior. */
	const longValueDetails = [
		{
			label: 'Program Path',
			value: '/programs/line-3/plates/J1055-M121-rev-04.cnc'
		},
		{
			label: 'Notes',
			value: 'Hold for QA sign-off before start · inspect first plate'
		}
	];

	/** Dense production counters (3-col). */
	const productionDetails = [
		{ label: 'Target', value: '500' },
		{ label: 'Good', value: '412' },
		{ label: 'Scrap', value: '8' },
		{ label: 'Rework', value: '3' },
		{ label: 'OEE', value: '87%' },
		{ label: 'Rate', value: '42 /h' }
	];

	const infoCards: KpiCardItem[] = [
		{ label: 'Name', value: '(Robotspace Testing) Test Project', icon: FolderOpen },
		{ label: 'Work Order No', value: 'RS-101', icon: ClipboardList },
		{ label: 'Customer', value: 'Reliance', icon: List },
		{ label: 'Contractor', value: 'Adani', icon: HardHat },
		{ label: 'Project Details', value: '-', icon: FileText },
		{ label: 'Line Details', value: 'Line', icon: Route },
		{ label: 'LOA No.', value: 'LOA', icon: Hash },
		{ label: 'Short Name', value: '-', icon: Tag }
	];
</script>

<svelte:head>
	<title>Card — iFactory UI v2</title>
</svelte:head>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<header class="space-y-2">
		<h1 class="text-3xl font-semibold">Card</h1>
		<p class="text-muted-foreground">
			Standard card patterns: details grid, key-value, status metrics, KPI and filter strips.
		</p>
	</header>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Extruder card</h2>
		<p class="text-sm text-muted-foreground">
			Zone temperatures with actual chips, ProgressMeter bars, and setpoints. Default chip tone band
			is ±10 °C (override via <code class="text-foreground">tempThresholds</code>).
		</p>
		<ExtruderCard
			name="Extruder 100"
			rpm={42.5}
			current={18.2}
			actual={extruder100Actual}
			set={extruder100Set}
		/>
		<ExtruderCard
			name="Extruder 120 (tolerance ±5 °C)"
			rpm={38.1}
			current={16.7}
			actual={extruder100Actual}
			set={extruder100Set}
			tempThresholds={{ okToleranceDeg: 5 }}
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Status metric cards</h2>
		<p class="text-sm text-muted-foreground">
			Solid-tone duration / metric tiles (uptime, downtime).
		</p>
		<div class="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
			<StatusMetricCard value="00:42:18" label="Uptime" tone="online" />
			<StatusMetricCard value="00:03:05" label="Downtime" tone="error" />
		</div>
	</section>

	<section class="space-y-8">
		<header class="space-y-1">
			<h2 class="text-xl font-semibold">Details card</h2>
			<p class="text-sm text-muted-foreground">
				Standard multi-field panel: optional caption plus a grid of stacked label / value cells.
				Supports <code class="text-foreground">columns</code> 2 · 3 · 4.
			</p>
		</header>

		<div class="space-y-3">
			<h3 class="text-base font-medium">2 columns · with caption</h3>
			<p class="text-sm text-muted-foreground">Default layout for a part / job summary.</p>
			<div class="max-w-xl">
				<DetailsCard caption="Job Details" items={partDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">2 columns · no caption</h3>
			<p class="text-sm text-muted-foreground">
				Compact pair when the surrounding screen already titles the block.
			</p>
			<div class="max-w-md">
				<DetailsCard items={sessionDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">3 columns</h3>
			<p class="text-sm text-muted-foreground">Wider snapshot for machine / asset fields.</p>
			<div class="max-w-3xl">
				<DetailsCard caption="Machine" columns={3} items={machineDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">4 columns</h3>
			<p class="text-sm text-muted-foreground">Single-row meta strip for work-order headers.</p>
			<div class="max-w-4xl">
				<DetailsCard caption="Work Order" columns={4} items={orderDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">Single field</h3>
			<p class="text-sm text-muted-foreground">One cell still sits in the muted panel shell.</p>
			<div class="max-w-xs">
				<DetailsCard caption="Identity" items={singleField} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">Odd item count</h3>
			<p class="text-sm text-muted-foreground">
				Three fields in a 2-col grid — the last row has one empty cell.
			</p>
			<div class="max-w-xl">
				<DetailsCard caption="Selection" items={oddCountDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">Inventory / stock</h3>
			<p class="text-sm text-muted-foreground">Quantity and location fields for warehouse views.</p>
			<div class="max-w-xl">
				<DetailsCard caption="Stock" items={stockDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">Device / fleet · 3 columns</h3>
			<p class="text-sm text-muted-foreground">Console or gateway identity and health.</p>
			<div class="max-w-3xl">
				<DetailsCard caption="Device" columns={3} items={deviceDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">Production counters · 3 columns</h3>
			<p class="text-sm text-muted-foreground">Dense numeric summary for a running line.</p>
			<div class="max-w-3xl">
				<DetailsCard caption="Production" columns={3} items={productionDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">Long values</h3>
			<p class="text-sm text-muted-foreground">
				Paths and notes — cells use <code class="text-foreground">min-w-0</code> so text can wrap.
			</p>
			<div class="max-w-2xl">
				<DetailsCard caption="Program" items={longValueDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">Side by side</h3>
			<p class="text-sm text-muted-foreground">Two panels in one row for compare / dual context.</p>
			<div class="grid max-w-4xl gap-4 sm:grid-cols-2">
				<DetailsCard caption="Inbound" items={stockDetails.slice(0, 2)} />
				<DetailsCard caption="Outbound" items={sessionDetails} />
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-base font-medium">Class overrides</h3>
			<p class="text-sm text-muted-foreground">
				Tighter panel padding via <code class="text-foreground">panelClass</code> /
				<code class="text-foreground">valueClass</code>.
			</p>
			<div class="max-w-xl">
				<DetailsCard
					caption="Compact"
					items={partDetails}
					panelClass="gap-x-6 gap-y-3 px-5 py-3"
					valueClass="text-lg"
				/>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">HMI machine card</h2>
		<p class="text-sm text-muted-foreground">
			Machine picker tiles for manual HMI — status rail, operator/job, metrics, and timer.
		</p>
		<div class="grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="h-80">
				<HmiMachineCard
					id="NJM-40"
					subtitle="Power Press"
					tone="online"
					badge="RUNNING"
					fields={[
						{ label: 'Operator', value: '0192 - Shivam' },
						{ label: 'Job', value: 'J1055-M121' }
					]}
					metrics={[
						{ label: 'Strokes', value: '1,284' },
						{ label: 'Planned', value: '200' }
					]}
					timer={{ label: 'Uptime', value: '01:12:40' }}
					class="h-full"
				/>
			</div>
			<div class="h-80">
				<HmiMachineCard
					id="NJM-41"
					subtitle="Power Press"
					tone="error"
					badge="REASON NEEDED"
					fields={[
						{ label: 'Operator', value: '0192 - Shivam' },
						{ label: 'Job', value: 'J1055-M121' }
					]}
					metrics={[
						{ label: 'Strokes', value: '1,284' },
						{ label: 'Planned', value: '200' }
					]}
					timer={{ label: 'Downtime', value: '00:08:42' }}
					class="h-full"
				/>
			</div>
			<div class="h-80">
				<HmiMachineCard
					id="NJM-28"
					subtitle="Hydraulic Stamping"
					tone="offline"
					badge="NO JOB"
					fields={[
						{ label: 'Operator', value: '0192 - Shivam' },
						{ label: 'Job', value: '—' }
					]}
					metrics={[
						{ label: 'Strokes', value: '—' },
						{ label: 'Planned', value: '—' }
					]}
					timer={{ label: 'Downtime', value: '00:00:00' }}
					class="h-full"
				/>
			</div>
			<div class="h-80">
				<HmiMachineCard
					id="NJM-24"
					subtitle="Hydraulic Press"
					tone="offline"
					badge="NO OPERATOR"
					emptyState={{
						message: 'No operator logged in',
						actionLabel: '+ Log in',
						onAction: () => console.log('Log in NJM-24')
					}}
					class="h-full"
				/>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Key-value card</h2>
		<p class="text-sm text-muted-foreground">
			Horizontal label / value row for meta fields like start time.
		</p>
		<div class="max-w-md">
			<KeyValueCard label="Start Time" value="1:40 PM" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Reason cards</h2>
		<p class="text-sm text-muted-foreground">
			Selectable stoppage / reason tiles with icon, label, and corner index.
		</p>
		<div class="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
			<ReasonCard label="No Plan" index={1} icon={CalendarX} />
			<ReasonCard label="CLIT" index={2} icon={Brush} />
			<ReasonCard label="Breakdown" index={3} icon={TriangleAlert} iconTone="error" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">KPI info strip</h2>
		<p class="text-sm text-muted-foreground">
			Read-only metadata grid for detail pages (2 rows × 4 columns).
		</p>
		<KpiCardStrip items={infoCards} columns={4} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Filter card strip</h2>
		<p class="text-sm text-muted-foreground">
			Click a card to filter. Total is display-only (<code>clickable: false</code>). Selected:
			<strong>{activeFilter}</strong>
		</p>
		<FilterCardStrip items={filterCards} bind:value={activeFilter} />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Standalone filter cards</h2>
		<div class="grid grid-cols-1 border border-border bg-white sm:grid-cols-3 lg:grid-cols-5">
			{#each filterCards as card, index (card.id)}
				<FilterCard
					label={card.label}
					value={card.count}
					icon={card.icon}
					selected={card.clickable !== false && activeFilter === card.id}
					{index}
					clickable={card.clickable !== false}
					onclick={() => (activeFilter = card.id)}
				/>
			{/each}
		</div>
	</section>
</div>
