import { cn } from '$lib/utils/cn';
import type { DialogIconTone, DialogSize, DialogVariant } from './dialog.constants';

export const dialogShellClass =
	'fixed inset-0 size-auto max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 backdrop:bg-transparent';

export const dialogBackdropClass = 'fixed inset-0 z-0 bg-gray-500/75 transition-opacity';

export const dialogPositionerClass =
	'relative z-10 flex min-h-full w-full items-end justify-center p-4 text-center focus:outline-none sm:items-center sm:p-0';

function dialogMaxWidthClass(size: DialogSize, variant: DialogVariant): string {
	if (variant === 'centered') {
		return {
			sm: 'sm:max-w-sm',
			md: 'sm:max-w-md',
			lg: 'sm:max-w-2xl',
			xl: 'sm:max-w-3xl'
		}[size];
	}

	return {
		sm: 'sm:max-w-md',
		md: 'sm:max-w-lg',
		lg: 'sm:max-w-2xl',
		xl: 'sm:max-w-3xl'
	}[size];
}

function dialogPanelPaddingClass(size: DialogSize): string {
	if (size === 'xl') {
		return 'px-6 pt-8 pb-6 sm:p-8';
	}
	return 'px-4 pt-5 pb-4 sm:p-6';
}

export function dialogPanelClass(
	variant: DialogVariant = 'centered',
	size: DialogSize = 'md',
	className = ''
): string {
	return cn(
		'relative flex max-h-[calc(100dvh-2rem)] w-full transform flex-col overflow-hidden bg-white text-left shadow-xl transition-all sm:my-8',
		dialogPanelPaddingClass(size),
		dialogMaxWidthClass(size, variant),
		className
	);
}

export function dialogCenteredIconWrapClass(size: DialogSize = 'md'): string {
	return cn(
		'mx-auto flex items-center justify-center rounded-full',
		size === 'xl' ? 'size-16' : 'size-12'
	);
}

export function dialogCenteredContentClass(size: DialogSize = 'md'): string {
	return size === 'xl' ? 'mt-4 text-center sm:mt-6' : 'mt-3 text-center sm:mt-5';
}

export function dialogCenteredTitleClass(size: DialogSize = 'md'): string {
	if (size === 'xl') {
		return 'font-heading text-2xl font-bold leading-8 text-gray-900 sm:text-3xl sm:leading-9';
	}
	return 'text-base font-semibold text-gray-900';
}

export function dialogCenteredDescriptionClass(size: DialogSize = 'md'): string {
	if (size === 'xl') {
		return 'mt-3 font-heading text-lg font-medium leading-7 text-gray-600 sm:text-xl sm:leading-8';
	}
	return 'mt-2 text-sm text-gray-500';
}

export const dialogAlertContentWrapClass = 'sm:flex sm:items-start';

export function dialogAlertIconWrapClass(size: DialogSize = 'md'): string {
	return cn(
		'mx-auto flex shrink-0 items-center justify-center rounded-full sm:mx-0',
		size === 'xl' ? 'size-16' : 'size-12 sm:size-10'
	);
}

export const dialogAlertTextWrapClass = 'mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left';

export function dialogAlertCloseClass(size: DialogSize = 'md'): string {
	return size === 'xl'
		? 'absolute right-3 top-3 z-10 sm:right-4 sm:top-4'
		: 'absolute right-2 top-2 z-10 sm:right-3 sm:top-2';
}

export function dialogIconToneClasses(tone?: DialogIconTone): string {
	if (!tone) return '';

	return cn({
		'bg-green-100 text-green-600': tone === 'success',
		'bg-amber-100 text-amber-600': tone === 'warning',
		'bg-red-100 text-red-600': tone === 'danger',
		'bg-blue-100 text-blue-600': tone === 'info'
	});
}

export function dialogFooterClass(variant: DialogVariant, size: DialogSize = 'md'): string {
	const spacing = size === 'xl' ? 'mt-6 sm:mt-8' : 'mt-5 sm:mt-6';
	const gap = size === 'xl' ? 'sm:gap-4' : 'sm:gap-3';

	if (variant === 'centered') {
		return spacing;
	}

	if (variant === 'centered-wide') {
		return cn(spacing, 'sm:grid sm:grid-flow-row-dense sm:grid-cols-2', gap);
	}

	if (variant === 'alert') {
		return spacing;
	}

	return size === 'xl'
		? 'mt-6 sm:mt-6 sm:flex sm:flex-row-reverse sm:px-6 sm:pb-6'
		: 'mt-5 sm:mt-4 sm:flex sm:flex-row-reverse sm:px-6 sm:pb-6';
}

export function dialogConfirmButtonClass(variant: DialogVariant): string {
	if (variant === 'centered-wide') {
		return 'w-full sm:col-start-2';
	}

	return 'w-full';
}

export function dialogCancelButtonClass(variant: DialogVariant): string {
	if (variant === 'centered-wide') {
		return 'w-full mt-3 sm:col-start-1 sm:mt-0';
	}

	return 'w-full';
}

/** @deprecated Use dialogConfirmButtonClass */
export function dialogPrimaryActionClass(variant: DialogVariant): string {
	return dialogConfirmButtonClass(variant);
}

/** @deprecated Use dialogCancelButtonClass */
export function dialogSecondaryActionClass(variant: DialogVariant): string {
	return dialogCancelButtonClass(variant);
}

export function contentPanelClass(size: DialogSize = 'md', className = ''): string {
	return cn(
		'relative flex max-h-[calc(100dvh-2rem)] w-full transform flex-col overflow-hidden bg-white text-left shadow-xl transition-all sm:my-8',
		{
			'sm:max-w-md': size === 'sm',
			'sm:max-w-lg': size === 'md',
			'sm:max-w-2xl': size === 'lg',
			'sm:max-w-3xl': size === 'xl'
		},
		className
	);
}

export const contentHeaderClass =
	'flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4';

export const contentTitleClass = 'text-base font-semibold text-gray-900';

export const contentBodyClass = 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4';

export const contentFooterClass =
	'grid shrink-0 grid-cols-2 gap-3 border-t border-border px-6 py-4';

export const contentButtonClass = 'w-full';
