<script lang="ts">
	import { HmiFlatButton } from '@ifactory/ui-v2';
	import {
		CircleCheck,
		ClipboardX,
		Clock,
		Play,
		RotateCw,
		TriangleAlert,
		User,
		UserX,
		X
	} from '@lucide/svelte';
	import {
		findCatalogReasonById,
		getSelectableCatalogReasons,
		reasonsCatalog
	} from '$lib/os/reasons-catalog.svelte.js';
	import ReasonGrid from '../../../pms-app/components/ReasonGrid.svelte';
	import type { StoppageReason } from '$lib/stoppage-reasons';
	import { pmsApp } from '../../../pms-app/app.svelte.js';
	import { reasonIcon, reasonLabel, reasonNumber } from '../../../pms-app/lib/reason-categories.js';
	import { isAppVisible } from '../app-visibility.svelte.js';
	import { launchApp, switchOperator, user, type AppDefinition } from '../index.svelte.js';
	import {
		SYNTHETIC_ALERT,
		beginChangeIdleReason,
		cancelChangeIdleReason,
		closeOverlayTicket,
		dismissMachineIdleOverlay,
		formatIdleHms,
		isSelectedOverlayReasonAcknowledgementRequired,
		machineIdleStore,
		machineStoppedOverlay,
		remindMachineIdleOverlayLater,
		selectOverlayReason,
		selectedOverlayAlert
	} from './machine-idle-store.svelte';

	/* Figma: HMI FROZEN DESIGN → alert · production without job, and the job-stopped screens
	   (stop-reason picker, stopped · reason logged) reused for Machine Idle. */

	/** Same rule the OS uses for the lockscreen: Switch Operator counts as logged out. */
	const loggedIn = $derived(Boolean(user.isLoggedIn) && !switchOperator.isClicked);
	const isProductionAlert = $derived(machineStoppedOverlay.productionAlert);
	const canCloseTicket = $derived(isSelectedOverlayReasonAcknowledgementRequired());
	const canChangeReason = $derived(
		!machineStoppedOverlay.reasonLocked && !canCloseTicket && !isProductionAlert
	);
	const canStartJob = $derived(loggedIn && !canCloseTicket);
	/** After a reason is shown the operator can hide the screen; the dock chip reopens it. */
	const canDismiss = $derived(selectedOverlayAlert.id !== '' && !canCloseTicket);
	const timer = $derived(formatIdleHms(machineIdleStore.idleSeconds));
	const startedAt = $derived(new Date(Date.now() - machineIdleStore.idleSeconds * 1000));
	/** Figma: `31-Oct-2026` and `5:26:31 PM`. */
	const startDate = $derived(
		startedAt
			.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
			.replace(/ /g, '-')
	);
	const startTime = $derived(
		startedAt.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		})
	);

	/** The picked catalog reason, or the synthetic production alarm (102 No Job / 103 No Login). */
	const reason = $derived.by((): StoppageReason | null => {
		if (selectedOverlayAlert.id === '') return null;
		const fromCatalog =
			typeof selectedOverlayAlert.id === 'number'
				? findCatalogReasonById(selectedOverlayAlert.id)
				: reasonsCatalog.reasons.find((r) => r.id === selectedOverlayAlert.id);
		return fromCatalog ?? null;
	});
	/** Catalog reasons show their grid number (as on the picker); synthetic alarms keep their code. */
	const alertId = $derived(
		selectedOverlayAlert.id === ''
			? '—'
			: ((reason ? reasonNumber(reason, getSelectableCatalogReasons()) : null) ??
					selectedOverlayAlert.id)
	);
	const alertLabel = $derived(
		reason ? reasonLabel(reason) : selectedOverlayAlert.label || 'Select a reason'
	);
	const AlertIcon = $derived(
		reason
			? reasonIcon(reason)
			: selectedOverlayAlert.id === SYNTHETIC_ALERT.NO_LOGIN
				? UserX
				: ClipboardX
	);

	const summaryRows = $derived([
		{
			label: 'Operator',
			value: loggedIn ? user.name || 'Logged in' : 'Not logged in',
			tone: loggedIn ? '' : 'text-[#b45309]'
		},
		{ label: 'Job', value: 'Not selected', tone: 'text-[#b45309]' },
		{ label: 'Date', value: startDate, tone: '' },
		{ label: 'From', value: startTime, tone: '' }
	]);
	const steps = $derived(
		canCloseTicket
			? loggedIn
				? ['Close the ticket once it is fixed', 'Select the job and start it']
				: [
						'Close the ticket once it is fixed',
						'Log in with your operator ID',
						'Select the job and start it'
					]
			: loggedIn
				? ['Select the job and start it']
				: ['Log in with your operator ID', 'Select the job and start it']
	);

	const reasons = $derived(getSelectableCatalogReasons());

	function onStartJob() {
		if (!canStartJob) return;
		const app = pmsApp as unknown as AppDefinition;
		if (!isAppVisible(app, true)) return;
		launchApp(app);
		dismissMachineIdleOverlay();
	}

	/** Logged out: the lockscreen is under this screen, so hiding it shows the login. */
	function onLogIn() {
		dismissMachineIdleOverlay();
	}

	const bigKeyFace = 'text-[34px] leading-[43px]';
</script>

{#if machineStoppedOverlay.isOpen}
	<!-- Over the OS shell or the lockscreen: the reason picker full screen, the alert as a panel. -->
	<div
		class="fixed inset-0 z-[110] flex min-h-0 flex-col items-center justify-center font-body text-[#1b2028] {machineStoppedOverlay.pickingReason
			? 'bg-white'
			: 'bg-[#1b2028]/60'}"
		role="dialog"
		aria-modal="true"
		aria-label={machineStoppedOverlay.pickingReason
			? 'Select idle reason'
			: isProductionAlert
				? 'Production Alert'
				: 'Machine Idle'}
	>
		{#if machineStoppedOverlay.pickingReason}
			<div class="flex h-full min-h-0 w-full flex-col">
				<header class="flex h-[78px] shrink-0 items-center gap-5 bg-[#e23b2e] px-[30px]">
					<span
						class="flex size-16 shrink-0 items-center justify-center rounded-[10px] bg-[#8e1f17] text-white"
					>
						<TriangleAlert class="size-9" strokeWidth={2.5} />
					</span>
					<p
						class="m-0 min-w-0 flex-1 truncate text-[40px] leading-[51px] font-bold tracking-[1.1px] text-white uppercase"
					>
						Machine idle
					</p>
					<p
						class="m-0 shrink-0 font-heading text-2xl leading-[33px] font-bold tracking-[0.6px] text-[#ffe4e1] uppercase"
					>
						Idle for
					</p>
					<p class="m-0 shrink-0 text-[52px] leading-[66px] font-bold text-white tabular-nums">
						{timer}
					</p>
					{#if selectedOverlayAlert.id !== ''}
						<button
							type="button"
							class="flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-2 border-white/60 bg-[#8e1f17] text-white"
							aria-label="Keep the current reason"
							title="Keep the current reason"
							onclick={() => cancelChangeIdleReason()}
						>
							<X class="size-8" strokeWidth={2.5} />
						</button>
					{/if}
				</header>

				<ReasonGrid
					{reasons}
					onselect={(picked) => selectOverlayReason(picked.id)}
					class="flex-1 pt-[34px] pr-[30px] pb-4 pl-7"
				/>
			</div>
		{:else}
			<!-- Figma: alert · production without job — a 1228 × 773 panel over the dimmed screen. -->
			<div
				class="flex h-[773px] max-h-full w-[1228px] max-w-full gap-6 rounded-xl bg-white px-[37px] pt-7 pb-[27px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
			>
				<div class="flex w-[658px] shrink-0 flex-col gap-5">
					<section
						class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 rounded-xl border-2 px-5 py-4 {isProductionAlert
							? 'border-[#f5b800] bg-[#fef6e7]'
							: 'border-[#f4c7c3] bg-[#fdf1f0]'}"
					>
						<div class="flex items-center gap-3">
							<span
								class="flex size-[52px] shrink-0 items-center justify-center rounded-[9px] {isProductionAlert
									? 'bg-[#f5b800] text-[#1a1d20]'
									: 'bg-[#dc2626] text-white'}"
							>
								<TriangleAlert class="size-[29px]" strokeWidth={2.5} />
							</span>
							<h1 class="m-0 text-[34px] leading-[43px] font-bold tracking-[1.1px] uppercase">
								{isProductionAlert ? 'Production without a job' : 'Machine idle'}
							</h1>
						</div>
						<p
							class="m-0 text-[128px] leading-[163px] font-bold tabular-nums {isProductionAlert
								? 'text-[#b45309]'
								: 'text-[#dc2626]'}"
							aria-label="{isProductionAlert ? 'Running for' : 'Idle for'} {timer}"
						>
							{timer}
						</p>
						<div
							class="flex h-[84px] max-w-full items-center gap-3.5 rounded-[10px] border-2 border-[#c3c8cf] bg-white px-[18px]"
						>
							<span
								class="flex size-14 shrink-0 items-center justify-center rounded-[9px] bg-[#3a3e46] text-white"
							>
								<AlertIcon class="size-[31px]" strokeWidth={2.2} />
							</span>
							<span class="truncate text-[32px] leading-[41px] font-bold">{alertLabel}</span>
							<span
								class="flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md bg-[#e5e7eb] px-1 text-lg leading-[23px] font-bold text-[#4b5563]"
							>
								{alertId}
							</span>
						</div>
					</section>

					{#if isProductionAlert}
						<HmiFlatButton
							label="Snooze for 5 mins"
							icon={Clock}
							size="lg"
							faceClass={bigKeyFace}
							iconClass="size-[42px]"
							onclick={() => remindMachineIdleOverlayLater()}
						/>
					{:else if canCloseTicket}
						<HmiFlatButton
							label="Close ticket"
							icon={CircleCheck}
							tone="stop"
							size="lg"
							faceClass={bigKeyFace}
							iconClass="size-[42px]"
							onclick={() => closeOverlayTicket()}
						/>
					{:else if canChangeReason}
						<HmiFlatButton
							label="Change reason"
							icon={RotateCw}
							size="lg"
							faceClass={bigKeyFace}
							iconClass="size-[42px]"
							onclick={() => beginChangeIdleReason()}
						/>
					{/if}
				</div>

				<div class="flex w-[472px] shrink-0 flex-col gap-4">
					{#if canDismiss}
						<!-- After a reason shows, the operator can hide this; the dock chip reopens it. -->
						<HmiFlatButton
							size="xs"
							icon={X}
							aria-label="Hide {isProductionAlert ? 'Production Alert' : 'Machine Idle'}"
							title="Hide · reopen from the dock"
							class="size-[72px] shrink-0 self-end"
							iconClass="size-8"
							onclick={() => dismissMachineIdleOverlay()}
						/>
					{/if}
					<section
						class="flex min-h-0 flex-1 flex-col rounded-xl border-2 border-[#c3c8cf] bg-white px-5 pt-2 pb-4"
					>
						{#each summaryRows as row (row.label)}
							<div class="flex h-[55px] shrink-0 items-center gap-3 border-b border-[#dde1e5]">
								<span
									class="min-w-0 flex-1 font-heading text-2xl leading-[33px] font-bold tracking-[0.6px] whitespace-nowrap text-[#5a616c] uppercase"
								>
									{row.label}
								</span>
								<span class="truncate text-[26px] leading-[33px] font-bold {row.tone}">
									{row.value}
								</span>
							</div>
						{/each}
					</section>

					<section
						class="flex shrink-0 flex-col gap-3 rounded-xl border-2 border-[#c3c8cf] bg-white px-[22px] py-[18px]"
					>
						<p class="m-0 text-[22px] leading-7 font-medium text-[#5a616c] uppercase">
							To clear this alert
						</p>
						{#each steps as step, index (step)}
							<div class="flex items-center gap-3.5">
								<span
									class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-xl leading-[26px]"
								>
									{index + 1}
								</span>
								<span class="text-2xl leading-[31px]">{step}</span>
							</div>
						{/each}
					</section>

					<!-- An open ticket comes first: CLOSE TICKET is the only action until it is closed. -->
					{#if !loggedIn && !canCloseTicket}
						<HmiFlatButton
							label="Log in"
							icon={User}
							tone="primary"
							size="lg"
							faceClass="text-[38px] leading-[48px]"
							iconClass="size-[42px]"
							onclick={onLogIn}
						/>
					{:else if canStartJob}
						<HmiFlatButton
							label="Start job"
							icon={Play}
							tone="primary"
							size="lg"
							faceClass="text-[38px] leading-[48px]"
							iconClass="size-[42px]"
							onclick={onStartJob}
						/>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
