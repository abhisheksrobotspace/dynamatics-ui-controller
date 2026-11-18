import { cn } from '$lib/utils/cn';
import type { AlertVariant } from './alert.constants';

export function alertPanelClass(
	variant: AlertVariant = 'info',
	accentBorder = false,
	className = ''
): string {
	if (accentBorder) {
		return cn(
			'border-l-4 p-4',
			{
				'border-yellow-400 bg-yellow-50': variant === 'warning',
				'border-red-400 bg-red-50': variant === 'error',
				'border-green-400 bg-green-50': variant === 'success',
				'border-blue-400 bg-blue-50': variant === 'info'
			},
			className
		);
	}

	return cn(
		'p-4',
		{
			'bg-green-50': variant === 'success',
			'bg-yellow-50': variant === 'warning',
			'bg-red-50': variant === 'error',
			'bg-blue-50': variant === 'info'
		},
		className
	);
}

export function alertIconClass(variant: AlertVariant = 'info'): string {
	return cn('size-5 shrink-0', {
		'text-green-400': variant === 'success',
		'text-yellow-400': variant === 'warning',
		'text-red-400': variant === 'error',
		'text-blue-400': variant === 'info'
	});
}

export function alertTitleClass(variant: AlertVariant = 'info'): string {
	return cn('text-sm font-medium', {
		'text-green-800': variant === 'success',
		'text-yellow-800': variant === 'warning',
		'text-red-800': variant === 'error',
		'text-blue-800': variant === 'info'
	});
}

export function alertDismissTitleClass(variant: AlertVariant = 'info'): string {
	return alertTitleClass(variant);
}

export function alertBodyClass(variant: AlertVariant = 'info'): string {
	return cn('mt-2 text-sm', {
		'text-green-700': variant === 'success',
		'text-yellow-700': variant === 'warning',
		'text-red-700': variant === 'error',
		'text-blue-700': variant === 'info'
	});
}

export function alertLinkRightTextClass(variant: AlertVariant = 'info'): string {
	return cn('text-sm', {
		'text-green-700': variant === 'success',
		'text-yellow-700': variant === 'warning',
		'text-red-700': variant === 'error',
		'text-blue-700': variant === 'info'
	});
}

export function alertAccentTextClass(variant: AlertVariant = 'info'): string {
	return alertLinkRightTextClass(variant);
}

export function alertInlineLinkClass(variant: AlertVariant = 'info'): string {
	return cn('font-medium underline', {
		'text-green-700 hover:text-green-600': variant === 'success',
		'text-yellow-700 hover:text-yellow-600': variant === 'warning',
		'text-red-700 hover:text-red-600': variant === 'error',
		'text-blue-700 hover:text-blue-600': variant === 'info'
	});
}

export function alertLinkClass(variant: AlertVariant = 'info'): string {
	return cn('font-medium whitespace-nowrap', {
		'text-green-700 hover:text-green-600': variant === 'success',
		'text-yellow-700 hover:text-yellow-600': variant === 'warning',
		'text-red-700 hover:text-red-600': variant === 'error',
		'text-blue-700 hover:text-blue-600': variant === 'info'
	});
}

export const alertListClass = 'list-disc space-y-1 pl-5';

export const alertActionsWrapClass = 'mt-4';
export const alertActionsRowClass = '-mx-2 -my-1.5 flex';

export function alertActionButtonClass(variant: AlertVariant = 'info'): string {
	return cn(
		'px-2 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2',
		{
			'bg-green-50 text-green-800 hover:bg-green-100 focus-visible:outline-green-600':
				variant === 'success',
			'bg-yellow-50 text-yellow-800 hover:bg-yellow-100 focus-visible:outline-yellow-600':
				variant === 'warning',
			'bg-red-50 text-red-800 hover:bg-red-100 focus-visible:outline-red-600': variant === 'error',
			'bg-blue-50 text-blue-800 hover:bg-blue-100 focus-visible:outline-blue-600':
				variant === 'info'
		}
	);
}

export const alertActionButtonSpacingClass = 'ml-3';

export const alertDismissWrapClass = 'ml-auto pl-3';
export const alertDismissButtonWrapClass = '-mx-1.5 -my-1.5';

export function alertDismissButtonClass(variant: AlertVariant = 'info'): string {
	return cn(
		'inline-flex p-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
		{
			'bg-green-50 text-green-500 hover:bg-green-100 focus-visible:ring-green-600 focus-visible:ring-offset-green-50':
				variant === 'success',
			'bg-yellow-50 text-yellow-500 hover:bg-yellow-100 focus-visible:ring-yellow-600 focus-visible:ring-offset-yellow-50':
				variant === 'warning',
			'bg-red-50 text-red-500 hover:bg-red-100 focus-visible:ring-red-600 focus-visible:ring-offset-red-50':
				variant === 'error',
			'bg-blue-50 text-blue-500 hover:bg-blue-100 focus-visible:ring-blue-600 focus-visible:ring-offset-blue-50':
				variant === 'info'
		}
	);
}

export const alertContentClass = 'ml-3';
export const alertLinkRightContentClass = 'ml-3 flex-1 md:flex md:justify-between';
export const alertLinkRightActionClass = 'mt-3 text-sm md:mt-0 md:ml-6';
