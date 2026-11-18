<script lang="ts">
	import { onMount } from 'svelte';
	import { BookOpen } from '@lucide/svelte';
	import { Alert, Button, Skeleton } from '@ifactory/ui-v2';
	import { getTicketSource, mapTicketStatus, TICKET_STATUS } from '../lib/constants.js';
	import { getTicket, rememberTicketLabel, updateTicket } from '../lib/tickets.api.js';
	import { listAlerts } from '../lib/alerts.api.js';
	import { listInstructions } from '../lib/instructions.api.js';
	import { listAssetManuals, listAssets, listShifts, listUsers } from '../lib/masters.api.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { pushErrorToast, pushSuccessToast } from '../lib/toast.js';
	import TicketInfoCard from '../components/ticket-details/TicketInfoCard.svelte';
	import TicketInstructionsCard from '../components/ticket-details/TicketInstructionsCard.svelte';
	import TicketCommentsCard from '../components/ticket-details/TicketCommentsCard.svelte';
	import BreakdownAnalysisCard from '../components/ticket-details/BreakdownAnalysisCard.svelte';
	import WhyAnalysisCard from '../components/ticket-details/WhyAnalysisCard.svelte';
	import TicketAttachmentsCard from '../components/ticket-details/TicketAttachmentsCard.svelte';
	import type {
		AlertMaster,
		AssetRef,
		Instruction,
		MaintenanceTicket,
		Shift,
		TicketFile,
		UserRef
	} from '../lib/types.js';

	let { params = {} }: { params?: Record<string, string> } = $props();

	const ticketId = $derived(Number(params.ticketId ?? ''));

	let ticket = $state<MaintenanceTicket | null>(null);
	let alerts = $state.raw<AlertMaster[]>([]);
	let users = $state.raw<UserRef[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let assets = $state.raw<AssetRef[]>([]);
	let instructions = $state.raw<Instruction[]>([]);
	let manuals = $state.raw<TicketFile[]>([]);

	let dataReady = $state(false);
	let loadError = $state<string | null>(null);

	const asset = $derived(
		ticket?.mid != null ? (assets.find((row) => row.id === ticket?.mid) ?? null) : null
	);
	const statusLabel = $derived(ticket ? mapTicketStatus(ticket.status) : '-');
	const statusTone = $derived.by(() => {
		if (statusLabel === 'Closed') return 'text-green-600';
		if (statusLabel === 'In Progress') return 'text-yellow-600';
		return 'text-red-600';
	});
	const statusDotTone = $derived.by(() => {
		if (statusLabel === 'Closed') return 'bg-green-600';
		if (statusLabel === 'In Progress') return 'bg-yellow-600';
		return 'bg-red-600';
	});
	const canStartWork = $derived(ticket?.status === TICKET_STATUS.OPEN);
	// v1: Close hidden for status 0 (closed) and 3 (ioWare already resolved).
	const canClose = $derived(
		ticket != null &&
			ticket.status !== TICKET_STATUS.CLOSED &&
			ticket.status !== TICKET_STATUS.IN_PROGRESS_ALT
	);

	async function loadTicket(signal?: AbortSignal) {
		const row = await getTicket(ticketId, signal);
		if (!row) {
			loadError = 'Ticket not found.';
			return;
		}
		ticket = row;
		rememberTicketLabel(String(row.id), `Ticket #${row.id}`);
	}

	function reload() {
		loadTicket().catch((error) => {
			pushErrorToast({ title: 'Failed to refresh ticket', description: formatErrorMessage(error) });
		});
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				const [, alertRows, userRows, shiftRows, assetRows, instructionRows] = await Promise.all([
					loadTicket(controller.signal),
					listAlerts(controller.signal),
					listUsers(controller.signal),
					listShifts(controller.signal),
					listAssets(controller.signal),
					listInstructions(controller.signal)
				]);
				alerts = alertRows;
				users = userRows;
				shifts = shiftRows;
				assets = assetRows;
				instructions = instructionRows;
				if (ticket?.mid != null) {
					manuals = await listAssetManuals(ticket.mid, controller.signal);
				}
			} catch (error) {
				if (isAbortError(error)) return;
				loadError = formatErrorMessage(error);
			} finally {
				if (!controller.signal.aborted) dataReady = true;
			}
		})();
		return () => controller.abort();
	});

	// --- Status workflow (v1: Start Work → status 2; Close depends on source) ---

	let isUpdatingStatus = $state<'start' | 'close' | null>(null);

	async function startWork() {
		if (!ticket) return;
		isUpdatingStatus = 'start';
		try {
			await updateTicket(ticket.id, { status: TICKET_STATUS.IN_PROGRESS });
			pushSuccessToast({ title: 'Work started.' });
			await loadTicket();
		} catch (error) {
			pushErrorToast({ title: 'Status update failed', description: formatErrorMessage(error) });
		} finally {
			isUpdatingStatus = null;
		}
	}

	async function closeTicket() {
		if (!ticket) return;
		isUpdatingStatus = 'close';
		try {
			const now = new Date().toISOString();
			if (getTicketSource(ticket.event_id) === 'ioWare') {
				// ioWare devices own the final close; we only mark resolved (status 3).
				await updateTicket(ticket.id, {
					status: TICKET_STATUS.IN_PROGRESS_ALT,
					resolved_at: ticket.resolved_at ?? now
				});
			} else {
				await updateTicket(ticket.id, {
					status: TICKET_STATUS.CLOSED,
					closed_at: now,
					resolved_at: ticket.resolved_at ?? now
				});
			}
			pushSuccessToast({ title: 'Ticket status updated.' });
			await loadTicket();
		} catch (error) {
			pushErrorToast({ title: 'Status update failed', description: formatErrorMessage(error) });
		} finally {
			isUpdatingStatus = null;
		}
	}
</script>

<div class="flex h-full flex-col gap-6 overflow-y-auto p-6">
	{#if loadError}
		<Alert variant="error" title="Could not load ticket" description={loadError} />
	{:else if !dataReady || !ticket}
		<div class="flex flex-col gap-4" aria-busy="true" role="status">
			<span class="sr-only">Loading ticket</span>
			<Skeleton class="h-10 w-1/2" />
			<Skeleton class="h-64 w-full" />
			<Skeleton class="h-40 w-full" />
		</div>
	{:else}
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
				<h1 class="font-heading text-xl font-bold text-foreground">Ticket #{ticket.id}</h1>
				<div class="flex flex-wrap items-center gap-4 text-sm">
					<span class="text-muted-foreground">Asset: {asset?.display_id ?? '-'}</span>
					<span class={`flex items-center gap-2 font-semibold ${statusTone}`}>
						<span class={`size-2 rounded-full ${statusDotTone}`}></span>
						{statusLabel}
					</span>
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if canStartWork}
					<Button
						label="Start Work"
						loading={isUpdatingStatus === 'start'}
						disabled={isUpdatingStatus !== null}
						onclick={startWork}
					/>
				{/if}
				{#if canClose}
					<Button
						variant="secondary"
						label="Close Ticket"
						loading={isUpdatingStatus === 'close'}
						disabled={isUpdatingStatus !== null}
						onclick={closeTicket}
					/>
				{/if}
			</div>
		</div>

		<!-- Main grid -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
			<div class="flex flex-col gap-6">
				<TicketInfoCard {ticket} {alerts} {users} {shifts} onChanged={reload} />
				<TicketInstructionsCard {ticket} {instructions} />
				<TicketCommentsCard ticketId={ticket.id} {users} />
				<BreakdownAnalysisCard {ticket} onChanged={reload} />
				<WhyAnalysisCard {ticket} onChanged={reload} />
			</div>

			<div class="flex flex-col gap-6">
				<section class="overflow-hidden border border-border bg-surface text-foreground">
					<div class="px-4 pt-4">
						<h3 class="font-heading text-base font-semibold">Associated Asset</h3>
					</div>
					<div class="flex flex-col gap-4 px-4 pt-3 pb-4 text-sm">
						<div>
							<p class="text-muted-foreground">Asset ID</p>
							<p class="font-semibold text-foreground">{asset?.display_id ?? '-'}</p>
						</div>
						<div>
							<p class="text-muted-foreground">Name</p>
							<p class="font-semibold text-foreground">{asset?.name ?? '-'}</p>
						</div>
						<div>
							<p class="text-muted-foreground">Model Number</p>
							<p class="font-semibold text-foreground">{asset?.model_no ?? '-'}</p>
						</div>
					</div>
				</section>

				<TicketAttachmentsCard ticketId={ticket.id} />

				<section class="overflow-hidden border border-border bg-surface text-foreground">
					<div class="px-4 pt-4">
						<h3 class="font-heading text-base font-semibold">Manuals</h3>
					</div>
					<div class="px-4 pt-3 pb-4">
						{#if manuals.length === 0}
							<p class="py-6 text-center text-sm text-muted-foreground">No Manuals</p>
						{:else}
							<div class="flex flex-col gap-2">
								{#each manuals as manual (manual.id)}
									<div class="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
										<div
											class="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600"
										>
											<BookOpen class="size-5" aria-hidden="true" />
										</div>
										<!-- eslint-disable svelte/no-navigation-without-resolve -- external file URL, not an app route -->
										<a
											href={manual.url}
											class="truncate font-medium text-foreground hover:text-primary hover:underline"
											target="_blank"
											rel="noopener noreferrer"
										>
											{manual.name}
										</a>
										<!-- eslint-enable svelte/no-navigation-without-resolve -->
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			</div>
		</div>
	{/if}
</div>
