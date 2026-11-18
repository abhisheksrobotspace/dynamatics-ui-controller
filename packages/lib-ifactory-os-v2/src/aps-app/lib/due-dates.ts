import { parseDdMmYyyy } from '@ifactory/ui-v2';
import { formatPlanDueDate } from './manufacturing-plans.js';
import { ddMmYyyyToOffsetIso, isoToDdMmYyyy } from './scheduler-datetime.js';

/** First non-empty ISO/date string wins (matches orchestrator precedence). */
export function resolveDueDate(candidates: Array<string | null | undefined>): string | null {
	for (const candidate of candidates) {
		if (candidate == null) continue;
		const trimmed = String(candidate).trim();
		if (trimmed) return trimmed;
	}
	return null;
}

export function formatDueDateCell(iso: string | null | undefined): string {
	if (!iso) return '-';
	return formatPlanDueDate(iso);
}

export function isoToDueDateDraft(iso: string | null | undefined): string {
	if (!iso) return '';
	return isoToDdMmYyyy(iso);
}

export function dueDateDraftToIso(draft: string): string | null {
	const trimmed = draft.trim();
	if (!trimmed) return null;
	return ddMmYyyyToOffsetIso(trimmed);
}

export type DueDateValidationOptions = {
	required?: boolean;
	minToday?: boolean;
};

export function validateDueDateDraft(
	draft: string,
	options: DueDateValidationOptions = {}
): string | null {
	const trimmed = draft.trim();
	if (!trimmed) {
		return options.required ? 'Enter a due date.' : null;
	}
	const parsed = parseDdMmYyyy(trimmed);
	if (!parsed) return 'Enter a valid due date (DD/MM/YYYY).';
	if (options.minToday) {
		const now = new Date();
		const day = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
		const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
		if (day < today) return 'Due date cannot be earlier than today.';
	}
	if (!dueDateDraftToIso(trimmed)) return 'Enter a valid due date (DD/MM/YYYY).';
	return null;
}
