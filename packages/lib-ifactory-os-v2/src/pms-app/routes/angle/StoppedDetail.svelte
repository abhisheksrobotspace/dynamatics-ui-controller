<script lang="ts">
	import {
		cancelJob,
		closeStoppedJobBreakdownTicket,
		displayMetric,
		formatHms,
		pmsStore
	} from '../../lib/hmi-store.svelte';
	import { jobDisplayLabel } from '../../lib/jobs';
	import { STOPPED_JOB } from '../../lib/display-defaults';
	import { reasonsCatalog } from '$lib/os/reasons-catalog.svelte.js';
	import { STOPPAGE_REASONS } from '$lib/stoppage-reasons';
	import type { AppNavigation } from '../../lib/navigation';
	import StoppedScreen from '../../components/StoppedScreen.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	const job = $derived(pmsStore.activeJob ?? STOPPED_JOB);
	const reason = $derived(
		pmsStore.selectedReason ?? reasonsCatalog.reasons[0] ?? STOPPAGE_REASONS[12]
	);
	const stoppedSeconds = $derived(pmsStore.activeJob ? pmsStore.stoppedSeconds : 8 * 60 + 42);

	const rows = $derived([
		{ label: 'Job ID', value: jobDisplayLabel(job) },
		{ label: 'Section', value: job.section },
		{ label: 'RM ID', value: job.rmId },
		{
			label: 'Pieces cut',
			value: `${displayMetric(job.piecesCut)} / ${displayMetric(job.piecesPlanned)}`,
			tone: 'text-[#f26522]'
		},
		{
			label: 'Bars',
			value: `${displayMetric(job.barsCompleted)} / ${displayMetric(job.barsPlanned)}`
		},
		{ label: 'Uptime', value: formatHms(pmsStore.uptimeSeconds) },
		{ label: 'Downtime', value: formatHms(pmsStore.downtimeSeconds), tone: 'text-[#dc2626]' }
	]);

	function endJob() {
		// Angle (bar) jobs auto-complete; End Job aborts via cancel. The 1.5 s hold is the confirmation.
		cancelJob();
		navigation.navigateTo('JobComplete');
	}
</script>

{#if job && reason}
	<StoppedScreen
		{reason}
		{stoppedSeconds}
		{rows}
		percent={job.completePercent ?? 0}
		onChangeReason={() => navigation.navigateTo('StoppageReasons')}
		onCloseTicket={() => closeStoppedJobBreakdownTicket(reason)}
		onEndJob={endJob}
	/>
{/if}
