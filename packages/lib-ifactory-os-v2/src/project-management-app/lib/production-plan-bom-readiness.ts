import type {
	BomConfig,
	BomOcrStatus,
	ReleaseStructureKind,
	ReleaseTowerEntry
} from './store.svelte.js';
import { getPublishedCpRunIdFromBom } from './projects/boms.api.js';

const OCR_READY: ReadonlySet<BomOcrStatus> = new Set(['verified', 'action_needed']);

function bomLabel(bom: BomConfig): string {
	return bom.bomName?.trim() || bom.id;
}

/** Block reason when editing qty on a production plan line (includes confirm gates). */
export function bomProductionPlanLineBlockReason(bom: BomConfig): string | null {
	const reasons = bomProductionPlanConfirmBlockReasons(bom);
	if (reasons.length > 0) return reasons[0] ?? null;

	const cpStatus = bom.cpStatus ?? 'none';
	if (cpStatus === 'planned' && !getPublishedCpRunIdFromBom(bom)) {
		return `${bomLabel(bom)}: publish a cutting plan version on All Runs first.`;
	}

	return null;
}

/** Block reasons for confirming a production plan when a BOM is not ready. */
export function bomProductionPlanConfirmBlockReasons(bom: BomConfig): string[] {
	const reasons: string[] = [];
	const label = bomLabel(bom);

	const ocrStatus = bom.ocrStatus ?? 'not_verified';
	if (!OCR_READY.has(ocrStatus)) {
		reasons.push(`${label}: complete Operations Count before confirming this plan.`);
	}

	const cpStatus = bom.cpStatus ?? 'none';
	if (cpStatus !== 'planned') {
		reasons.push(`${label}: complete Cutting Plan before confirming this plan.`);
	} else if (!getPublishedCpRunIdFromBom(bom)) {
		reasons.push(
			`${label}: publish a cutting plan version on All Runs before confirming this plan.`
		);
	}

	return reasons;
}

export function findProductionPlanConfirmBlockers(boms: BomConfig[]): string[] {
	return boms.flatMap((bom) => bomProductionPlanConfirmBlockReasons(bom));
}

/** Action text for a blocked line, without the leading BOM label. */
export function bomProductionPlanLineBlockAction(bom: BomConfig): string | null {
	const reason = bomProductionPlanLineBlockReason(bom);
	if (!reason) return null;

	const label = bomLabel(bom);
	const prefix = `${label}: `;
	return reason.startsWith(prefix) ? reason.slice(prefix.length) : reason;
}

export function formatProductionPlanLineBlockAlert(
	structureName: string,
	bom: BomConfig,
	lineDescription?: string
): string | null {
	const action = bomProductionPlanLineBlockAction(bom);
	if (!action) return null;

	const bomName = bom.bomName?.trim() || lineDescription?.trim() || bom.id;
	return `${structureName} / ${bomName}: ${action}`;
}

export function collectProductionPlanLineBlockAlerts(
	entries: readonly ReleaseTowerEntry[],
	bomById: ReadonlyMap<string, BomConfig>,
	structureNameFor: (structureId: string, kind: ReleaseStructureKind) => string
): string[] {
	const seen = new Set<string>();
	const messages: string[] = [];

	for (const entry of entries) {
		const structureName = structureNameFor(entry.towerTypeId, entry.kind);
		for (const line of entry.lineItems) {
			const bom = bomById.get(line.bomId);
			if (!bom) continue;

			const message = formatProductionPlanLineBlockAlert(structureName, bom, line.description);
			if (!message) continue;

			const key = `${entry.kind}:${entry.towerTypeId}:${line.bomId}:${message}`;
			if (seen.has(key)) continue;
			seen.add(key);
			messages.push(message);
		}
	}

	return messages;
}
