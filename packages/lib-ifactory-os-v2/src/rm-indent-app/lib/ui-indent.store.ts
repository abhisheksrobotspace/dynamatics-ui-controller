import { procureKey } from './indent-remaining.js';

export type UiIndentLine = {
	itemId: string;
	section: string;
	/** Plan / requirement length — never edited on the indent. */
	requiredLengthMm: number;
	/** Editable procure length (may differ from required). */
	toProcureLengthMm: number;
	requiredQty: number;
	toProcureQty: number;
	requiredWeightKg: number | null;
};

export type UiIndent = {
	indentId: string;
	indentNo: number;
	planId: string;
	planLabel: string;
	month: string;
	projectId: string;
	projectLabel: string;
	lines: UiIndentLine[];
	createdAt: string;
};

let indents: UiIndent[] = [];
let nextIndentNo = 1;

function normalizeLine(line: UiIndentLine): UiIndentLine {
	return {
		...line,
		requiredLengthMm: Math.max(0, Math.round(line.requiredLengthMm)),
		toProcureLengthMm: Math.max(0, Math.round(line.toProcureLengthMm)),
		requiredQty: Math.max(0, Math.round(line.requiredQty)),
		toProcureQty: Math.max(0, Math.round(line.toProcureQty))
	};
}

function cloneIndent(indent: UiIndent): UiIndent {
	return {
		...indent,
		lines: indent.lines.map((line) => ({ ...line }))
	};
}

export function isUiIndentId(indentId: string): boolean {
	return indentId.startsWith('ui-indent:');
}

export function listUiIndents(): UiIndent[] {
	return indents.map(cloneIndent).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUiIndent(indentId: string): UiIndent | undefined {
	const found = indents.find((row) => row.indentId === indentId);
	return found ? cloneIndent(found) : undefined;
}

/** Replace lines on a UI indent (session-only). Drops lines with toProcure ≤ 0. */
export function updateUiIndentLines(indentId: string, lines: UiIndentLine[]): UiIndent | undefined {
	const index = indents.findIndex((row) => row.indentId === indentId);
	if (index < 0) return undefined;
	const nextLines = lines.map(normalizeLine).filter((line) => line.toProcureQty > 0);
	if (nextLines.length === 0) {
		throw new Error('Indent must keep at least one line with To Procure > 0.');
	}
	const current = indents[index];
	const updated: UiIndent = {
		...current,
		lines: nextLines
	};
	indents = [...indents.slice(0, index), updated, ...indents.slice(index + 1)];
	return cloneIndent(updated);
}

export type CreateUiIndentInput = {
	planId: string;
	planLabel: string;
	month: string;
	projectId: string;
	projectLabel: string;
	lines: UiIndentLine[];
};

/** Persist a session-only indent (no datahub). */
export function createUiIndent(input: CreateUiIndentInput): UiIndent {
	const lines = input.lines.map(normalizeLine).filter((line) => line.toProcureQty > 0);
	if (lines.length === 0) {
		throw new Error('No lines to procure.');
	}
	const indentNo = nextIndentNo++;
	const saved: UiIndent = {
		indentId: `ui-indent:${indentNo}`,
		indentNo,
		planId: input.planId,
		planLabel: input.planLabel,
		month: input.month,
		projectId: input.projectId,
		projectLabel: input.projectLabel,
		lines,
		createdAt: new Date().toISOString()
	};
	indents = [...indents, saved];
	return cloneIndent(saved);
}

/**
 * Sum toProcure already raised for a project, keyed by *required* length
 * (requirement slot), so changing to-procure length does not free remaining.
 */
export function sumUiProcuredBySection(projectId: string): Map<string, number> {
	const procured = new Map<string, number>();
	for (const indent of indents) {
		if (indent.projectId !== projectId) continue;
		for (const line of indent.lines) {
			const key = procureKey({
				projectId,
				itemId: line.itemId,
				section: line.section,
				lengthMm: line.requiredLengthMm
			});
			procured.set(key, (procured.get(key) ?? 0) + line.toProcureQty);
		}
	}
	return procured;
}

export function sectionKey(line: Pick<UiIndentLine, 'itemId' | 'section'>): string {
	return line.itemId || line.section || '';
}
