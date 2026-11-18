import { line as angleLine } from './angle';
import { line as manualLine } from './manual';
import { line as plateLine } from './plate';
import type { PmsLine, PmsLineId, PmsPageName, PmsScreen } from './types';

const LINES: Record<PmsLineId, PmsLine> = {
	angle: angleLine,
	plate: plateLine,
	manual: manualLine
};

export function screensFor(lineId: PmsLineId): Record<PmsPageName, PmsScreen> {
	return LINES[lineId].screens;
}

export function lineFor(lineId: PmsLineId): PmsLine {
	return LINES[lineId];
}
