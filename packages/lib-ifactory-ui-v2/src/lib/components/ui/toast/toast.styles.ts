import { cn } from '$lib/utils/cn';
import type {
	ToastActionPlacement,
	ToastActionVariant,
	ToastIconAlign,
	ToastPosition,
	ToastVariant
} from './toast.constants';

function toastHorizontalClass(position: ToastPosition): string {
	if (position.endsWith('left')) return 'justify-start';
	if (position.endsWith('center')) return 'justify-center';
	return 'justify-end';
}

function toastInnerAlignClass(position: ToastPosition): string {
	if (position.endsWith('left')) return 'items-start';
	if (position.endsWith('center')) return 'items-center';
	return 'items-end';
}

export function isBottomToastPosition(position: ToastPosition): boolean {
	return position.startsWith('bottom');
}

export const toastViewportClass = (
	embedded = false,
	position: ToastPosition = 'top-right',
	className = ''
): string =>
	cn(
		embedded
			? 'pointer-events-none absolute inset-0 flex p-4 sm:p-6'
			: 'pointer-events-none fixed inset-0 z-50 flex p-4 sm:p-6',
		position.startsWith('top') ? 'items-start' : 'items-end',
		toastHorizontalClass(position),
		className
	);

export const toastViewportInnerClass = (
	embedded = false,
	position: ToastPosition = 'top-right'
): string =>
	cn(
		'flex w-full flex-col gap-4',
		toastInnerAlignClass(position),
		embedded && 'pointer-events-none'
	);

export function toastPanelClass(
	actionPlacement: ToastActionPlacement = 'below',
	className = '',
	variant: ToastVariant = 'default'
): string {
	return cn(
		'pointer-events-auto w-full max-w-sm shrink-0 shadow-lg outline-1',
		{
			'bg-white outline-black/5': variant === 'default',
			'border border-green-400 bg-green-50 outline-green-400/30': variant === 'success',
			'border border-red-400 bg-red-50 outline-red-400/30': variant === 'error'
		},
		actionPlacement === 'side' && 'flex max-w-md',
		className
	);
}

export function toastTitleClassForVariant(variant: ToastVariant = 'default'): string {
	return cn('text-sm font-medium', {
		'text-gray-900': variant === 'default',
		'text-green-800': variant === 'success',
		'text-red-800': variant === 'error'
	});
}

export function toastDescriptionClassForVariant(variant: ToastVariant = 'default'): string {
	return cn('mt-1 text-sm', {
		'text-gray-500': variant === 'default',
		'text-green-700': variant === 'success',
		'text-red-700': variant === 'error'
	});
}

export function toastCloseButtonClassForVariant(variant: ToastVariant = 'default'): string {
	return cn('inline-flex focus:outline-none', {
		'text-gray-400 hover:text-gray-500': variant === 'default',
		'text-green-400 hover:text-green-500': variant === 'success',
		'text-red-400 hover:text-red-500': variant === 'error'
	});
}

export const toastContentClass = 'p-4';

export const toastSideContentClass = 'w-0 flex-1 p-4';

export const toastCloseButtonClass =
	'inline-flex text-gray-400 hover:text-gray-500 focus:outline-none';

export const toastTitleClass = 'text-sm font-medium text-gray-900';

export const toastDescriptionClass = 'mt-1 text-sm text-gray-500';

export const toastBelowActionsClass = 'mt-3 flex space-x-7';

export const toastAvatarActionsClass = 'mt-4 flex';

export const toastSideActionWrapClass = 'flex border-l border-gray-200';

export const toastSideActionButtonClass =
	'flex w-full items-center justify-center p-4 text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none';

export function toastActionButtonClass(variant: ToastActionVariant = 'text'): string {
	return cn('text-sm font-medium focus:outline-none', {
		'text-indigo-600 hover:text-indigo-500': variant === 'text',
		'text-gray-700 hover:text-gray-500': variant === 'muted',
		'inline-flex items-center bg-indigo-600 px-2.5 py-1.5 font-semibold text-white shadow-xs hover:bg-indigo-500':
			variant === 'primary',
		'inline-flex items-center bg-white px-2.5 py-1.5 font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50':
			variant === 'outline'
	});
}

export const toastInlineActionButtonClass =
	'ml-3 shrink-0 bg-white text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none';

export const toastAvatarClass =
	'size-10 rounded-full bg-gray-100 outline -outline-offset-1 outline-black/5';

export function toastRowClass(align: ToastIconAlign = 'start'): string {
	return cn('flex', {
		'items-start': align === 'start',
		'items-center': align === 'center',
		'items-end': align === 'end'
	});
}

export function toastLeadingOffsetClass(align: ToastIconAlign = 'start'): string {
	return align === 'start' ? 'pt-0.5' : '';
}

export const TOAST_STACK_PEEK = 14;
export const TOAST_STACK_MAX_VISIBLE = 3;

export function toastStackContainerClass(
	expanded: boolean,
	position: ToastPosition = 'top-right'
): string {
	return cn(
		'relative w-full max-w-sm transition-[height] duration-300 ease-out',
		expanded && 'flex gap-2',
		expanded && (isBottomToastPosition(position) ? 'flex-col-reverse' : 'flex-col')
	);
}

export function toastStackItemClass(
	expanded: boolean,
	index: number,
	position: ToastPosition = 'top-right'
): string {
	const isBottom = isBottomToastPosition(position);

	return cn(
		'w-full transition-all duration-300 ease-out',
		expanded
			? 'relative shrink-0'
			: cn('absolute inset-x-0', isBottom ? 'bottom-0 origin-bottom' : 'top-0 origin-top'),
		!expanded && index >= TOAST_STACK_MAX_VISIBLE && 'pointer-events-none opacity-0'
	);
}

export function toastStackItemStyle(
	index: number,
	total: number,
	expanded: boolean,
	baseHeight: number,
	position: ToastPosition = 'top-right'
): string | undefined {
	if (expanded) return undefined;

	const visibleIndex = Math.min(index, TOAST_STACK_MAX_VISIBLE - 1);
	const scale = 1 - visibleIndex * 0.05;
	const direction = isBottomToastPosition(position) ? -1 : 1;
	const translateY = visibleIndex * TOAST_STACK_PEEK * direction;

	return [
		`transform: translateY(${translateY}px) scale(${scale})`,
		`z-index: ${total - index}`,
		index === 0 ? 'opacity: 1' : `opacity: ${Math.max(0.4, 1 - visibleIndex * 0.2)}`,
		index < TOAST_STACK_MAX_VISIBLE ? '' : 'visibility: hidden',
		index === 0 ? '' : 'pointer-events: none',
		`--stack-base-height: ${baseHeight}px`
	]
		.filter(Boolean)
		.join('; ');
}

export function toastStackFlyOffset(position: ToastPosition = 'top-right'): number {
	return isBottomToastPosition(position) ? 12 : -12;
}

export function toastStackContainerHeight(
	count: number,
	baseHeight: number,
	expanded: boolean
): string | undefined {
	if (expanded || count === 0) return undefined;

	const peekCount = Math.min(Math.max(count - 1, 0), TOAST_STACK_MAX_VISIBLE - 1);
	return `${baseHeight + peekCount * TOAST_STACK_PEEK}px`;
}
