import { v7 as uuidv7 } from 'uuid';
import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { ensureSelectedAssetId, getSelectedAssetId, withAssetId } from '$lib/os/asset-context.js';
import { publishOperatorLogin, publishOperatorLogout } from '$lib/os/cloud-events.js';

export type OperatorSession = {
	oid: string;
	sid: string;
	loginAt: string;
};

let currentSession: OperatorSession | null = null;

export function getOperatorSession(): OperatorSession | null {
	return currentSession;
}

/** Controller reads `session:<aid>.current` (PMS_MIGRATION §10). */
async function sessionSliceKey(): Promise<string | null> {
	const aid = (await ensureSelectedAssetId()) ?? getSelectedAssetId();
	return aid ? `session:${aid}` : null;
}

/**
 * Mint `sid` (uuid v7), persist KV `session:<aid>.current`, Path A `14001`, and `/iow/operatorLoggedIn`.
 * `metadata` rides on the 14001 payload only.
 */
export async function beginOperatorSession(
	oid: string,
	metadata?: Record<string, unknown>
): Promise<OperatorSession> {
	const session: OperatorSession = {
		oid,
		sid: uuidv7(),
		loginAt: new Date().toISOString()
	};
	currentSession = session;

	await ensureSelectedAssetId();
	const slice = await sessionSliceKey();
	if (slice) {
		const result = await globalMqtt.add(slice, { current: session });
		if (result && typeof result === 'object' && 'error' in result) {
			console.error('Failed to write session KV', result.error);
		}
	} else {
		console.error('beginOperatorSession: no aid — skipped session KV write');
	}

	await publishOperatorLogin({
		oid: session.oid,
		sid: session.sid,
		loginAt: session.loginAt,
		...(metadata ? { metadata } : {})
	});
	globalMqtt.publish(
		'/iow/operatorLoggedIn',
		withAssetId({
			oid: session.oid,
			sid: session.sid
		})
	);

	return session;
}

/**
 * Clear local session memory + KV without cloud/controller logout.
 * Use when the controller already ended the session (`/iow/operatorSessionEnded` /
 * its own `14002`) — do not emit a second `14002` or `/iow/operatorLoggedOut`.
 */
export async function clearOperatorSessionLocally(): Promise<OperatorSession | null> {
	const previous = currentSession;
	currentSession = null;
	await ensureSelectedAssetId();
	const slice = await sessionSliceKey();
	if (slice) {
		const result = await globalMqtt.delete(slice, { keys: ['current'] });
		if (result && typeof result === 'object' && 'error' in result) {
			console.error('Failed to delete session KV', result.error);
		}
	}
	return previous;
}

const OPERATOR_SESSION_ENDED_TOPIC = '/iow/operatorSessionEnded';

/**
 * Controller restart ended the stored operator session (already sent cloud `14002`).
 * Clears local session; `onEnded` should show the lockscreen (no second logout publish).
 */
export function bindOperatorSessionEndedMqtt(onEnded?: () => void): () => void {
	const onEvent = (topic: string, data: unknown) => {
		if (topic !== OPERATOR_SESSION_ENDED_TOPIC) return;
		const payload = data && typeof data === 'object' ? (data as { aid?: unknown }) : null;
		const aid = typeof payload?.aid === 'string' ? payload.aid : null;
		const selected = getSelectedAssetId();
		if (aid && selected && aid !== selected) return;

		void clearOperatorSessionLocally().then(() => onEnded?.());
	};

	globalMqtt.subscribeTopics([OPERATOR_SESSION_ENDED_TOPIC]);
	globalMqtt.on('event', onEvent);
	return () => {
		globalMqtt.off('event', onEvent);
	};
}

type BeforeLogoutHandler = () => void | Promise<void>;
const beforeLogoutHandlers = new Set<BeforeLogoutHandler>();

/**
 * Let an open screen finish up (e.g. a job summary saving its counts) before the operator logs out
 * from the task bar. Returns the unregister function.
 */
export function onBeforeOperatorLogout(handler: BeforeLogoutHandler): () => void {
	beforeLogoutHandlers.add(handler);
	return () => {
		beforeLogoutHandlers.delete(handler);
	};
}

/** Run the `onBeforeOperatorLogout` handlers; a failing handler never blocks the logout. */
export async function runBeforeOperatorLogout(): Promise<void> {
	for (const handler of [...beforeLogoutHandlers]) {
		try {
			await handler();
		} catch (error) {
			console.error('Before-logout handler failed', error);
		}
	}
}

/**
 * Path A `14002`, `/iow/operatorLoggedOut`, clear KV `session:<aid>.current`.
 * Returns the cleared session for callers that need the last oid/sid.
 */
export async function endOperatorSession(): Promise<OperatorSession | null> {
	const previous = currentSession;
	currentSession = null;
	await ensureSelectedAssetId();

	if (previous) {
		await publishOperatorLogout({
			oid: previous.oid,
			sid: previous.sid,
			logoutAt: new Date().toISOString()
		});
		globalMqtt.publish(
			'/iow/operatorLoggedOut',
			withAssetId({
				oid: previous.oid,
				sid: previous.sid
			})
		);
	} else {
		globalMqtt.publish('/iow/operatorLoggedOut', withAssetId({}));
	}

	const slice = await sessionSliceKey();
	if (slice) {
		const result = await globalMqtt.delete(slice, { keys: ['current'] });
		if (result && typeof result === 'object' && 'error' in result) {
			console.error('Failed to delete session KV', result.error);
		}
	}
	return previous;
}
