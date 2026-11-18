/** Same-browser tab coordination — instant cross-tab signal without DB polling. */
const CHANNEL_NAME = 'ifactory-aps-schedule';

export type ApsScheduleBusMessage =
	{ type: 'started'; planId: string } | { type: 'ended'; planId: string };

export function broadcastApsScheduleStarted(planId: string): void {
	if (!planId.trim() || typeof BroadcastChannel === 'undefined') return;
	new BroadcastChannel(CHANNEL_NAME).postMessage({
		type: 'started',
		planId
	} satisfies ApsScheduleBusMessage);
}

export function broadcastApsScheduleEnded(planId: string): void {
	if (!planId.trim() || typeof BroadcastChannel === 'undefined') return;
	new BroadcastChannel(CHANNEL_NAME).postMessage({
		type: 'ended',
		planId
	} satisfies ApsScheduleBusMessage);
}

export function subscribeApsScheduleBus(
	planId: string,
	onMessage: (message: ApsScheduleBusMessage) => void
): () => void {
	if (!planId.trim() || typeof BroadcastChannel === 'undefined') return () => {};
	const channel = new BroadcastChannel(CHANNEL_NAME);
	const handler = (event: MessageEvent<ApsScheduleBusMessage>) => {
		const message = event.data;
		if (!message || message.planId !== planId) return;
		onMessage(message);
	};
	channel.addEventListener('message', handler);
	return () => {
		channel.removeEventListener('message', handler);
		channel.close();
	};
}
