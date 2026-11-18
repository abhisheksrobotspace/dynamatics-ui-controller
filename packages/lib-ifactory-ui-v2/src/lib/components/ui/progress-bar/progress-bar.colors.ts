import type { ProgressBarStep } from './progress-bar.constants';
import type { ProgressBarStepStatus } from './progress-bar.utils';

export type ProgressBarTone = 'primary' | 'online' | 'error' | 'loading' | 'neutral';

export type ProgressBarColorConfig = {
	tone?: ProgressBarTone;
	complete?: ProgressBarTone;
	current?: ProgressBarTone;
	upcoming?: ProgressBarTone;
};

export type ProgressBarStepColorSet = {
	solid: string;
	border: string;
	text: string;
	soft: string;
	solidHover: string;
	borderHover: string;
	connector: string;
	indicator: string;
	checkIcon: string;
	upcomingBorder: string;
	upcomingText: string;
	upcomingDot: string;
	upcomingDotHover: string;
	completeTitle: string;
};

const TONE_SETS: Record<
	ProgressBarTone,
	Omit<
		ProgressBarStepColorSet,
		'upcomingBorder' | 'upcomingText' | 'upcomingDot' | 'upcomingDotHover' | 'completeTitle'
	>
> = {
	primary: {
		solid: 'bg-primary',
		border: 'border-primary',
		text: 'text-primary',
		soft: 'bg-primary/20',
		solidHover: 'hover:bg-primary/90',
		borderHover: 'hover:border-primary/80',
		connector: 'bg-primary',
		indicator: 'bg-primary',
		checkIcon: 'text-white'
	},
	online: {
		solid: 'bg-status-online',
		border: 'border-status-online',
		text: 'text-status-online',
		soft: 'bg-status-online/20',
		solidHover: 'hover:bg-status-online/90',
		borderHover: 'hover:border-status-online/80',
		connector: 'bg-status-online',
		indicator: 'bg-status-online',
		checkIcon: 'text-white'
	},
	error: {
		solid: 'bg-status-error',
		border: 'border-status-error',
		text: 'text-status-error',
		soft: 'bg-status-error/20',
		solidHover: 'hover:bg-status-error/90',
		borderHover: 'hover:border-status-error/80',
		connector: 'bg-status-error',
		indicator: 'bg-status-error',
		checkIcon: 'text-white'
	},
	loading: {
		solid: 'bg-status-loading',
		border: 'border-status-loading',
		text: 'text-status-loading',
		soft: 'bg-status-loading/20',
		solidHover: 'hover:bg-status-loading/90',
		borderHover: 'hover:border-status-loading/80',
		connector: 'bg-status-loading',
		indicator: 'bg-status-loading',
		checkIcon: 'text-white'
	},
	neutral: {
		solid: 'bg-muted-foreground',
		border: 'border-border',
		text: 'text-muted-foreground',
		soft: 'bg-muted',
		solidHover: 'hover:bg-muted-foreground/90',
		borderHover: 'hover:border-border',
		connector: 'bg-border',
		indicator: 'bg-border',
		checkIcon: 'text-white'
	}
};

const NEUTRAL_UPCOMING = {
	upcomingBorder: 'border-border',
	upcomingText: 'text-muted-foreground',
	upcomingDot: 'bg-border',
	upcomingDotHover: 'group-hover:bg-muted',
	completeTitle: 'text-foreground'
};

function toneForStatus(
	status: ProgressBarStepStatus,
	step: ProgressBarStep,
	config: ProgressBarColorConfig
): ProgressBarTone {
	if (step.color) {
		return step.color;
	}

	if (status === 'complete' && config.complete) {
		return config.complete;
	}

	if (status === 'current' && config.current) {
		return config.current;
	}

	if (status === 'upcoming' && config.upcoming) {
		return config.upcoming;
	}

	return config.tone ?? 'primary';
}

export function resolveProgressBarStepColors(
	status: ProgressBarStepStatus,
	step: ProgressBarStep,
	config: ProgressBarColorConfig = {}
): ProgressBarStepColorSet {
	const tone = toneForStatus(status, step, config);
	const accent = TONE_SETS[tone];

	if (tone === 'neutral') {
		return {
			...accent,
			...NEUTRAL_UPCOMING,
			completeTitle: 'text-muted-foreground',
			connector: 'bg-border',
			indicator: 'bg-transparent'
		};
	}

	if (status === 'upcoming' && !step.color && !config.upcoming) {
		return {
			...accent,
			...NEUTRAL_UPCOMING,
			connector: 'bg-border',
			indicator: 'bg-transparent'
		};
	}

	return {
		...accent,
		...NEUTRAL_UPCOMING,
		connector: status === 'upcoming' ? 'bg-border' : accent.connector,
		indicator: status === 'current' ? accent.indicator : 'bg-transparent'
	};
}
