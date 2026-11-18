import { cn } from '$lib/utils/cn';
import { cardShellClasses, type CardVariant } from '../card/card.styles';
import type { EmptyStateVariant } from './empty-state.constants';

export function emptyStateRootClass(variant: EmptyStateVariant = 'simple', className = ''): string {
	return cn(
		variant === 'simple' && 'text-center',
		variant === 'dashed' &&
			'relative block w-full border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none',
		className
	);
}

export function emptyStateCardClass(variant: CardVariant = 'default', className = ''): string {
	return cardShellClasses(variant, className);
}

export const emptyStateCardContentClass = 'px-6 py-12';

export const emptyStateCardDashedContentClass = 'p-6';

export const emptyStateIconClass = 'mx-auto size-12 text-gray-400';

export const emptyStateDashedIconClass = 'mx-auto size-12 text-gray-400';

export const emptyStateTitleClass = 'mt-2 text-sm font-semibold text-gray-900';

export const emptyStateDescriptionClass = 'mt-1 text-sm text-gray-500';

export const emptyStateActionWrapClass = 'mt-6';

export const emptyStateDashedTitleClass = 'mt-2 block text-sm font-medium text-gray-900';
