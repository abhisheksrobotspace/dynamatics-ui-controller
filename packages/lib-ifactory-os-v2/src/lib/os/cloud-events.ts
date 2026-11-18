import { v7 as uuidv7 } from 'uuid';
import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { ensureSelectedAssetId, getSelectedAssetId } from '$lib/os/asset-context.js';

const D2C_TOPIC = '/rt/d2c';

type CloudEventDef = {
	eg: number;
	eid: number;
	ec?: number;
};

/** Path A — UI publishes a complete envelope; the runtime bridge forwards it. */
function buildEnvelope(aid: string, event: CloudEventDef, pl: Record<string, unknown>) {
	return {
		uuid: uuidv7(),
		aid,
		eg: event.eg,
		eid: event.eid,
		ec: event.ec ?? 0,
		ts: new Date().toISOString(),
		pl
	};
}

async function publishPathA(event: CloudEventDef, pl: Record<string, unknown>) {
	await ensureSelectedAssetId();
	const aid = getSelectedAssetId();
	if (!aid) {
		console.error('Path A publish skipped — no assetId (aid) for envelope', event);
		return;
	}
	globalMqtt.publish(D2C_TOPIC, buildEnvelope(aid, event, pl));
}

/**
 * `14001 operatorLogin` — UI mints `sid`; oid is operators.operator_id uuid.
 * `metadata` carries login-time extras (e.g. the HMI safety check) for the cloud metadata column.
 */
export async function publishOperatorLogin(pl: {
	oid: string;
	sid: string;
	loginAt?: string;
	metadata?: Record<string, unknown>;
}) {
	await publishPathA({ eg: 14000, eid: 14001 }, pl);
}

/** `14002 operatorLogout` */
export async function publishOperatorLogout(pl: { oid: string; sid: string; logoutAt?: string }) {
	await publishPathA({ eg: 14000, eid: 14002 }, pl);
}

/** `11003 clitReport` — checklist submission the UI can complete alone. */
export async function publishClitReport(pl: {
	items: Array<{ key: string; ok: boolean; note?: string }>;
	oid?: string;
	sid?: string;
	submittedAt?: string;
}) {
	await publishPathA(
		{ eg: 11000, eid: 11003 },
		{
			...pl,
			submittedAt: pl.submittedAt ?? new Date().toISOString()
		}
	);
}
