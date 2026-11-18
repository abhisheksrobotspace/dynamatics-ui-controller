<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { AlertDialog, EmptyState } from '@ifactory/ui-v2';
	import { AlertTriangle, LoaderCircle } from '@lucide/svelte';
	import { bindPmsMqttEvents, pmsStore, publishCurrentScreen } from '../lib/hmi-store.svelte';
	import { bindPmsLine, pmsLineStore } from '../lib/pms-line.svelte';
	import type { AppNavigation } from '../lib/navigation';
	import { screensFor } from '../lines/registry';
	import type { PmsPageName } from '../lines/types';

	/** AI-OS / controller screen names for `/iow/currentScreen`. */
	const CURRENT_SCREEN_BY_PAGE: Record<PmsPageName, string> = {
		StartJob: 'selectJob',
		JobRunning: 'productionTracking',
		StoppageReasons: 'jobStoppedAlert',
		StoppedDetail: 'jobStopped',
		JobComplete: 'jobSummary',
		JobCard: 'jobCard',
		JobCardDrawings: 'jobCardDrawings'
	};

	const app = $state<{ currentPage: PmsPageName; pageHistory: PmsPageName[] }>({
		currentPage: 'StartJob',
		pageHistory: []
	});

	let unbindMqtt = $state<(() => void) | null>(null);
	let unbindLine = $state<(() => void) | null>(null);
	/** Non-reactive: only used to debounce navigation reset on store revision bumps. */
	let lastRevision = -1;

	const screens = $derived(pmsLineStore.lineId ? screensFor(pmsLineStore.lineId) : null);
	const CurrentScreen = $derived(screens ? screens[app.currentPage] : null);
	/**
	 * `open` is boolean. Binding it to the message would write `false` over the string.
	 * A writable `$derived` still follows the next message after the dialog closes.
	 */
	let jobFailedOpen = $derived(Boolean(pmsStore.jobCompleteFailedMessage));
	let jobRejectedOpen = $derived(Boolean(pmsStore.jobRejectedMessage));

	function navigateTo(page: string) {
		const next = page as PmsPageName;
		const active = pmsLineStore.lineId ? screensFor(pmsLineStore.lineId) : null;
		if (!active || !(next in active)) return;
		if (app.currentPage !== next) {
			app.pageHistory = [...app.pageHistory, app.currentPage];
		}
		app.currentPage = next;
	}

	function goBack(): boolean {
		if (app.pageHistory.length === 0) return false;
		const previousPage = app.pageHistory[app.pageHistory.length - 1];
		app.pageHistory = app.pageHistory.slice(0, -1);
		app.currentPage = previousPage;
		return true;
	}

	const navigation: AppNavigation = {
		navigateTo,
		goBack
	};

	$effect(() => {
		const revision = pmsLineStore.revision;
		if (!pmsLineStore.ready || revision === lastRevision) return;
		lastRevision = revision;
		app.currentPage = 'StartJob';
		app.pageHistory = [];
	});

	$effect(() => {
		if (!CurrentScreen) return;
		publishCurrentScreen(CURRENT_SCREEN_BY_PAGE[app.currentPage]);
	});

	function clearFailedMessage() {
		pmsStore.jobCompleteFailedMessage = null;
	}

	function clearRejectedMessage() {
		pmsStore.jobRejectedMessage = null;
	}

	onMount(() => {
		unbindLine = bindPmsLine();
		unbindMqtt = bindPmsMqttEvents(navigateTo);
	});

	onDestroy(() => {
		unbindMqtt?.();
		unbindLine?.();
	});
</script>

<div class="h-full min-h-0 w-full">
	{#if !pmsLineStore.ready}
		<div class="flex h-full items-center justify-center p-8">
			<EmptyState title="Loading machine…" icon={LoaderCircle} />
		</div>
	{:else if !CurrentScreen}
		<div class="flex h-full items-center justify-center p-8">
			<EmptyState
				title="PMS unavailable"
				description={pmsLineStore.error ?? 'No supported machine class in machineSettings.'}
				icon={AlertTriangle}
			/>
		</div>
	{:else}
		<CurrentScreen {navigation} />
	{/if}
</div>

<AlertDialog
	bind:open={jobFailedOpen}
	size="xl"
	title="Unable to cancel job"
	description={pmsStore.jobCompleteFailedMessage ?? ''}
	actionLabel="OK"
	onAction={clearFailedMessage}
	onOpenChange={(open) => {
		if (!open) clearFailedMessage();
	}}
/>

<AlertDialog
	bind:open={jobRejectedOpen}
	size="xl"
	title="Unable to start job"
	description={pmsStore.jobRejectedMessage ?? ''}
	actionLabel="OK"
	onAction={clearRejectedMessage}
	onOpenChange={(open) => {
		if (!open) clearRejectedMessage();
	}}
/>
