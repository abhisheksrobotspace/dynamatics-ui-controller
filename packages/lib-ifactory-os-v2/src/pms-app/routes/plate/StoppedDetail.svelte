<script lang="ts">
	import {
		cancelJob,
		closeStoppedJobBreakdownTicket,
		displayMetric,
		formatHms,
		pmsStore
	} from '../../lib/hmi-store.svelte';
	import { jobDisplayLabel } from '../../lib/jobs';
	import { reasonsCatalog } from '$lib/os/reasons-catalog.svelte.js';
	import { STOPPAGE_REASONS } from '$lib/stoppage-reasons';
	import type { AppNavigation } from '../../lib/navigation';
	import StoppedScreen from '../../components/StoppedScreen.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	const job = $derived(pmsStore.activeJob);
	const reason = $derived(
		pmsStore.selectedReason ?? reasonsCatalog.reasons[0] ?? STOPPAGE_REASONS[12]
	);

	const rows = $derived([
		{ label: 'Job ID', value: job ? jobDisplayLabel(job) : '-' },
		{ label: 'Mark', value: displayMetric(job?.markNo ?? job?.marks?.[0]?.id) },
		{ label: 'Thickness', value: displayMetric(job?.thickness) },
		{
			label: 'Plates',
			value: `${displayMetric(job?.piecesCut)} / ${displayMetric(job?.plannedPlates ?? job?.piecesPlanned)}`,
			tone: 'text-[#f26522]'
		},
		{
			label: 'Holes',
			value: job?.holes != null ? Number(job.holes).toLocaleString() : '-'
		},
		{ label: 'Uptime', value: formatHms(pmsStore.uptimeSeconds) },
		{ label: 'Downtime', value: formatHms(pmsStore.downtimeSeconds), tone: 'text-[#dc2626]' }
	]);

	function endJob() {
		// The 1.5 s hold is the confirmation; the plate job is cancelled and the summary opens.
		cancelJob();
		navigation.navigateTo('JobComplete');
	}
</script>

{#if reason}
	<StoppedScreen
		{reason}
		stoppedSeconds={pmsStore.stoppedSeconds}
		{rows}
		percent={job?.completePercent ?? 0}
		onChangeReason={() => navigation.navigateTo('StoppageReasons')}
		onCloseTicket={() => closeStoppedJobBreakdownTicket(reason)}
		onEndJob={endJob}
	/>
{/if}
