<script lang="ts">
	import {
		Alert,
		Calendar,
		type CalendarEvent,
		type CalendarEventColor,
		type CalendarView
	} from '@ifactory/ui-v2';
	import AddEventDialog from '../components/AddEventDialog.svelte';
	import { listEventOccurrences, type EventOccurrence } from '../lib/events.api.js';
	import { listAssets } from '../lib/masters.api.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import type { AssetRef, TicketPriority } from '../lib/types.js';

	let view = $state<CalendarView>('month');
	let date = $state(new Date());
	let isEventDialogOpen = $state(false);
	let eventDialogId = $state<number | null>(null);
	let refreshKey = $state(0);

	let assets = $state.raw<AssetRef[]>([]);
	let occurrences = $state.raw<EventOccurrence[]>([]);
	let loadError = $state<string | null>(null);

	const PRIORITY_COLORS: Record<TicketPriority, CalendarEventColor> = {
		High: 'red',
		Medium: 'orange',
		Low: 'green'
	};

	/**
	 * Fetch window for the current view. Month is padded a week either side
	 * for the leading/trailing grid cells; year covers the whole year.
	 */
	const fetchRange = $derived.by((): { from: Date; till: Date } => {
		const year = date.getFullYear();
		const month = date.getMonth();
		if (view === 'year') {
			// Pad for mini-month overflow cells at the year grid edges.
			return {
				from: new Date(year, 0, -7),
				till: new Date(year, 11, 38, 23, 59, 59)
			};
		}
		if (view === 'month') {
			return {
				from: new Date(year, month, -7),
				till: new Date(year, month + 1, 8, 23, 59, 59)
			};
		}
		if (view === 'week') {
			const day = date.getDay();
			const mondayOffset = day === 0 ? -6 : 1 - day;
			const mondayDay = date.getDate() + mondayOffset;
			return {
				from: new Date(year, month, mondayDay, 0, 0, 0, 0),
				till: new Date(year, month, mondayDay + 6, 23, 59, 59, 0)
			};
		}
		// Day view: load the full month grid so the sidebar mini-calendar can show event dots.
		return {
			from: new Date(year, month, -7),
			till: new Date(year, month + 1, 8, 23, 59, 59)
		};
	});

	const assetNameById = $derived(new Map(assets.map((asset) => [asset.id, asset.display_id])));

	const calendarEvents = $derived(
		occurrences.map((occurrence): CalendarEvent => ({
			id: occurrence.key,
			title: occurrence.event.title,
			start: occurrence.start,
			end: occurrence.end,
			subtitle: occurrence.event.mid != null ? assetNameById.get(occurrence.event.mid) : undefined,
			badge: occurrence.event.priority ?? undefined,
			color: occurrence.event.priority ? PRIORITY_COLORS[occurrence.event.priority] : 'blue'
		}))
	);

	function openAddEvent() {
		eventDialogId = null;
		isEventDialogOpen = true;
	}

	function openEvent(calendarEvent: CalendarEvent) {
		// Occurrence keys are `${event id}:${start ISO}`; editing targets the series.
		const eventId = Number(String(calendarEvent.id).split(':')[0]);
		if (Number.isNaN(eventId)) return;
		eventDialogId = eventId;
		isEventDialogOpen = true;
	}

	function handleEventSaved() {
		refreshKey++;
	}

	// Refetch when the visible range changes (view switch / navigation).
	$effect(() => {
		const { from, till } = fetchRange;
		void refreshKey;
		const controller = new AbortController();
		void (async () => {
			try {
				const [loadedAssets, loadedOccurrences] = await Promise.all([
					listAssets(controller.signal),
					listEventOccurrences(from, till, controller.signal)
				]);
				assets = loadedAssets;
				occurrences = loadedOccurrences;
				loadError = null;
			} catch (error) {
				if (isAbortError(error)) return;
				loadError = formatErrorMessage(error);
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	{#if loadError}
		<div class="p-4">
			<Alert variant="error" title="Could not load events" description={loadError} />
		</div>
	{/if}
	<Calendar
		class="min-h-0 flex-1"
		bind:view
		bind:date
		events={calendarEvents}
		addEventLabel="Add event"
		onAddEvent={openAddEvent}
		onEventClick={openEvent}
	/>
</div>

<AddEventDialog bind:open={isEventDialogOpen} eventId={eventDialogId} onSaved={handleEventSaved} />
