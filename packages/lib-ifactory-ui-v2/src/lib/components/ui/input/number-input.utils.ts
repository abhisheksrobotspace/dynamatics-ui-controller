export function inferStepFromText(text: string): number {
	const trimmed = text.trim();
	if (trimmed === '' || trimmed === '-' || trimmed === '.') return 1;

	const dotIndex = trimmed.indexOf('.');
	if (dotIndex === -1) return 1;

	const fraction = trimmed.slice(dotIndex + 1);
	if (fraction.length === 0) return 1;

	return 10 ** -fraction.length;
}

export function decimalPlacesForStep(step: number): number {
	if (step >= 1) return 0;
	return Math.max(0, -Math.floor(Math.log10(step)));
}

export function adjustByStep(value: number, step: number, direction: 1 | -1): number {
	const places = decimalPlacesForStep(step);
	const factor = 10 ** places;
	return (Math.round(value * factor) + direction * Math.round(step * factor)) / factor;
}

export function isIntermediateNumberInput(text: string): boolean {
	const trimmed = text.trim();
	if (trimmed === '' || trimmed === '-' || trimmed === '.') return true;
	if (trimmed.endsWith('.')) return true;
	if (/^-0+\.?$/.test(trimmed)) return true;
	return false;
}

export function parseNumberInput(text: string): number | null {
	if (isIntermediateNumberInput(text)) return null;
	const parsed = Number(text);
	return Number.isNaN(parsed) ? null : parsed;
}
