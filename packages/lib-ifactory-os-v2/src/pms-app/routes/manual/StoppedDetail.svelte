<script lang="ts">
	import {
		closeStoppedJobBreakdownTicket,
		displayMetric,
		endJob,
		formatHms,
		pmsStore
	} from '../../lib/hmi-store.svelte';
	import { jobDisplayLabel, manualHoleProgress } from '../../lib/jobs';
	import { reasonsCatalog } from '$lib/os/reasons-catalog.svelte.js';
	import { STOPPAGE_REASONS } from '$lib/stoppage-reasons';
	import type { AppNavigation } from '../../lib/navigation';
	import StoppedScreen from '../../components/StoppedScreen.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	const job = $derived(pmsStore.activeJob);
	const reason = $derived(
		pmsStore.selectedReason ?? reasonsCatalog.reasons[0] ?? STOPPAGE_REASONS[12]
	);
	const progress = $derived(manualHoleProgress(job));
	/** Holes made of those planned; the job's own percent when the plan is not known. */
	const percent = $derived(
		progress.holes != null && progress.planned
			? (progress.holes / progress.planned) * 100
			: (job?.completePercent ?? 0)
	);

	const rows = $derived([
		{ label: 'Job ID', value: job ? jobDisplayLabel(job) : '-' },
		{ label: 'Mark no', value: job?.markNo ?? job?.marks[0]?.id ?? '-' },
		{ label: 'Bundle no', value: job?.bundleNo ?? '-' },
		{
			label: 'Holes',
			value: progress.holes == null ? '-' : progress.holes.toLocaleString('en-US'),
			tone: 'text-[#f26522]'
		},
		{ label: progress.plannedLabel, value: displayMetric(progress.planned) },
		{ label: 'Uptime', value: formatHms(pmsStore.uptimeSeconds) },
		{ label: 'Downtime', value: formatHms(pmsStore.downtimeSeconds), tone: 'text-[#dc2626]' }
	]);

	function endBundle() {
		// The 1.5 s hold is the confirmation; the bundle ends and its summary opens.
		endJob();
		navigation.navigateTo('JobComplete');
	}
</script>

{#if reason}
	<StoppedScreen
		{reason}
		stoppedSeconds={pmsStore.stoppedSeconds}
		{rows}
		{percent}
		onChangeReason={() => navigation.navigateTo('StoppageReasons')}
		onCloseTicket={() => closeStoppedJobBreakdownTicket(reason)}
		onEndJob={endBundle}
	/>
{/if}
