<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Building2, CreditCard, UserRound, UsersRound } from '@lucide/svelte';
	import { Tabs } from '$lib';
	import type { TabItem } from '$lib/components/ui/tabs';

	const accountTabs: TabItem[] = [
		{ label: 'My Account', value: 'account', icon: UserRound },
		{ label: 'Company', value: 'company', icon: Building2 },
		{ label: 'Team Members', value: 'team', icon: UsersRound, current: true },
		{ label: 'Billing', value: 'billing', icon: CreditCard }
	];

	const viewTabs: TabItem[] = [
		{ label: 'Grid', value: 'grid', current: true },
		{ label: 'List', value: 'list' }
	];

	const reportTabs: TabItem[] = [
		{ label: 'Overview Report', value: 'overview' },
		{ label: 'Performance Report', value: 'performance', current: true },
		{ label: 'Production Report', value: 'production' },
		{ label: 'Downtime Report', value: 'downtime' }
	];

	const pillTabs: TabItem[] = accountTabs.map(({ label, value, current }) => ({
		label,
		value,
		current
	}));

	let activeViewTab = $state('grid');
	let activeAccountTab = $state('team');
	let activePillTab = $state('team');
	let activeReportTab = $state('performance');
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Tabs</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Underline, pill, and segmented tab variants with optional icons, mobile select fallback, and
			controlled value binding.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Underline</h2>
		<p class="text-sm text-muted-foreground">Active tab: {activeViewTab}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-4">
			<Tabs items={viewTabs} bind:value={activeViewTab} variant="underline" mobileSelect={false} />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Underline with icons</h2>
		<p class="text-sm text-muted-foreground">Active tab: {activeAccountTab}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-4">
			<Tabs items={accountTabs} bind:value={activeAccountTab} variant="underline" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Pills</h2>
		<p class="text-sm text-muted-foreground">Active tab: {activePillTab}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-4">
			<Tabs items={pillTabs} bind:value={activePillTab} variant="pills" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Segmented</h2>
		<p class="text-sm text-muted-foreground">Active tab: {activeReportTab}</p>
		<div class="rounded-lg border border-border bg-surface px-6 py-4">
			<Tabs items={reportTabs} bind:value={activeReportTab} variant="segmented" />
		</div>
	</section>
</div>
