export type ProgressBarVariant = 'panels' | 'circles' | 'bullets';

export type ProgressBarAlign = 'horizontal' | 'vertical';

export type ProgressBarButtonPlacement = 'below' | 'beside';

export type ProgressBarLabelPlacement = 'below' | 'beside';

export type { ProgressBarColorConfig, ProgressBarTone } from './progress-bar.colors';

export type ProgressBarStep = {
	label: string;
	description?: string;
	href?: string;
	value?: string;
	current?: boolean;
	/** When set, overrides sequential complete/current/upcoming derived from `value`. */
	status?: import('./progress-bar.utils').ProgressBarStepStatus;
	onclick?: () => void;
	buttonLabel?: string;
	buttonDisabled?: boolean;
	onButtonClick?: () => void;
	color?: import('./progress-bar.colors').ProgressBarTone;
};

export const defaultPanelsSteps: ProgressBarStep[] = [
	{ label: 'Job Details', description: 'Vitae sed mi luctus laoreet.', value: 'job-details' },
	{
		label: 'Application form',
		description: 'Cursus semper viverra.',
		value: 'application-form',
		current: true
	},
	{ label: 'Preview', description: 'Penatibus eu quis ante.', value: 'preview' }
];

export const defaultCirclesSteps: ProgressBarStep[] = [
	{ label: 'Step 1', value: '1' },
	{ label: 'Step 2', value: '2' },
	{ label: 'Step 3', value: '3', current: true },
	{ label: 'Step 4', value: '4' },
	{ label: 'Step 5', value: '5' }
];

export const defaultCirclesWithTextSteps: ProgressBarStep[] = [
	{
		label: 'Create account',
		description: 'Vitae sed mi luctus laoreet.',
		value: 'create-account'
	},
	{
		label: 'Profile information',
		description: 'Cursus semper viverra facilisis et et some more.',
		value: 'profile',
		current: true
	},
	{
		label: 'Business information',
		description: 'Penatibus eu quis ante.',
		value: 'business'
	},
	{ label: 'Theme', description: 'Faucibus nec enim leo et.', value: 'theme' },
	{
		label: 'Preview',
		description: 'Iusto et officia maiores porro ad non quas.',
		value: 'preview'
	}
];

export const defaultBulletsSteps: ProgressBarStep[] = [
	{ label: 'Create account', value: 'create-account' },
	{ label: 'Profile information', value: 'profile', current: true },
	{ label: 'Theme', value: 'theme' },
	{ label: 'Preview', value: 'preview' }
];
