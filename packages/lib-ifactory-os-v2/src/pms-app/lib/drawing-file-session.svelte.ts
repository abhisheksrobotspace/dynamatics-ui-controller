import type { Attachment } from 'svelte/attachments';
import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { getUUID } from '$lib/os/lib/utils/getUUID.js';
import {
	DRAWING_FILES_CHANGED,
	DRAWING_FILES_RESULT,
	drawingFetchForDest,
	drawingFetchMessage,
	drawingStatusMessage,
	parseDrawingFileNotice,
	shouldRefetchDrawing
} from './drawing-files.js';
import type { JobCardDrawing } from './job-card-display.js';

type Notice = { status: string; error?: string };

/**
 * Runtime status for the open drawings screen.
 * MQTT updates this object from the event callback. The screen reads it.
 */
export class DrawingFileSession {
	notices = $state<Record<string, Notice>>({});
	viewerIndex = $state(0);

	#stop: (() => void) | null = null;
	#key = '';
	#retried: Record<string, true> = {};
	#placed = false;
	#card: Record<string, unknown> | undefined;
	#drawings: JobCardDrawing[] = [];
	#start: JobCardDrawing | undefined;

	watch(
		card: Record<string, unknown> | undefined,
		drawings: JobCardDrawing[],
		startIndex: number
	): void {
		this.#card = card;
		this.#drawings = drawings;
		this.#start = drawings[startIndex] ?? drawings[0];
		this.#listen();
		const key = drawings.map((row) => `${row.dest}:${row.expired}`).join('|');
		if (key === this.#key) return;
		this.#key = key;
		this.#retried = {};
		this.#placed = false;
		for (const drawing of drawings) {
			if (!drawing.dest || drawing.expired) continue;
			const message = drawingStatusMessage(drawing.dest, getUUID());
			globalMqtt.publish(message.topic, message.body);
		}
	}

	close(): void {
		this.#stop?.();
		this.#key = '';
	}

	#listen(): void {
		if (this.#stop) return;
		const onEvent = (topic: string, data: unknown) => {
			const notice = parseDrawingFileNotice(topic, data);
			if (!notice || !this.#drawings.some((row) => row.dest === notice.dest)) return;
			this.notices = {
				...this.notices,
				[notice.dest]: notice.error
					? { status: notice.status, error: notice.error }
					: { status: notice.status }
			};
			this.#place(notice.dest, notice.status);
			const row = this.#drawings.find((item) => item.dest === notice.dest);
			if (
				!row ||
				!shouldRefetchDrawing({
					expired: row.expired,
					status: notice.status,
					error: notice.error
				}) ||
				this.#retried[notice.dest]
			) {
				return;
			}
			this.#retried[notice.dest] = true;
			const fetch = drawingFetchForDest(this.#card, notice.dest);
			if (!fetch) return;
			const message = drawingFetchMessage(fetch, getUUID());
			globalMqtt.publish(message.topic, message.body);
		};
		globalMqtt.subscribeTopics([DRAWING_FILES_RESULT, DRAWING_FILES_CHANGED]);
		globalMqtt.on('event', onEvent);
		this.#stop = () => {
			globalMqtt.off('event', onEvent);
			this.#stop = null;
		};
	}

	#place(dest: string, status: string): void {
		const start = this.#start;
		if (this.#placed || !start || dest !== start.dest || status !== 'ready') return;
		const at = this.#drawings
			.filter(
				(drawing) =>
					drawing.src && !drawing.expired && this.notices[drawing.dest]?.status === 'ready'
			)
			.findIndex((drawing) => drawing.id === start.id);
		if (at >= 0) this.viewerIndex = at;
		this.#placed = true;
	}
}

/** Attach to the drawings screen. Re-runs when the card or the drawing list changes. */
export function watchDrawings(
	session: DrawingFileSession,
	card: Record<string, unknown> | undefined,
	drawings: JobCardDrawing[],
	startIndex: number
): Attachment {
	return () => {
		session.watch(card, drawings, startIndex);
		return () => session.close();
	};
}
