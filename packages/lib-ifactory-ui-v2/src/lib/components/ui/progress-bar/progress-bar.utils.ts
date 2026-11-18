import type { ProgressBarStep } from './progress-bar.constants';

export type ProgressBarStepStatus = 'complete' | 'current' | 'upcoming';

export type ProgressBarStepButtonPayload = {
	step: ProgressBarStep;
	index: number;
	status: ProgressBarStepStatus;
	value: string;
};

export const progressBarStepStaticClass = 'cursor-default';

export function stepValue(step: ProgressBarStep, index: number): string {
	return step.value ?? String(index);
}

export function resolveActiveIndex(items: ProgressBarStep[], value: string): number {
	if (value) {
		const index = items.findIndex((item, index) => stepValue(item, index) === value);
		if (index >= 0) {
			return index;
		}
	}

	const currentItem = items.findIndex((item) => item.current);
	if (currentItem >= 0) {
		return currentItem;
	}

	return 0;
}

export function stepStatus(index: number, activeIndex: number): ProgressBarStepStatus {
	if (index < activeIndex) {
		return 'complete';
	}

	if (index === activeIndex) {
		return 'current';
	}

	return 'upcoming';
}

export function formatStepNumber(index: number): string {
	return String(index + 1).padStart(2, '0');
}

export function shouldShowVerticalStepButton(
	showButton: boolean,
	align: 'horizontal' | 'vertical',
	step: { buttonLabel?: string },
	status: ProgressBarStepStatus
): boolean {
	if (!showButton || align !== 'vertical') {
		return false;
	}

	if (step.buttonLabel) {
		return true;
	}

	return status === 'current' || status === 'complete';
}

export function verticalStepButtonLabel(
	step: { buttonLabel?: string },
	status: ProgressBarStepStatus,
	defaultLabel: string
): string {
	if (step.buttonLabel) {
		return step.buttonLabel;
	}

	return status === 'complete' ? 'Edit' : defaultLabel;
}

export function verticalStepButtonVariant(
	status: ProgressBarStepStatus
): 'primary' | 'outline' | 'ghost' {
	if (status === 'complete') {
		return 'outline';
	}

	if (status === 'current') {
		return 'primary';
	}

	return 'ghost';
}

export function nextStepIndex(items: ProgressBarStep[], currentIndex: number): number | null {
	const nextIndex = currentIndex + 1;
	return nextIndex < items.length ? nextIndex : null;
}

export function previousStepIndex(items: ProgressBarStep[], currentIndex: number): number | null {
	const previousIndex = currentIndex - 1;
	return previousIndex >= 0 ? previousIndex : null;
}

export function stepValueAtIndex(items: ProgressBarStep[], index: number): string | null {
	const step = items[index];
	return step ? stepValue(step, index) : null;
}

export function defaultStepButtonAction(
	items: ProgressBarStep[],
	index: number,
	status: ProgressBarStepStatus
): string | null {
	if (status === 'current') {
		const nextIndex = nextStepIndex(items, index);
		return nextIndex === null ? null : stepValueAtIndex(items, nextIndex);
	}

	if (status === 'complete') {
		return stepValueAtIndex(items, index);
	}

	return null;
}
