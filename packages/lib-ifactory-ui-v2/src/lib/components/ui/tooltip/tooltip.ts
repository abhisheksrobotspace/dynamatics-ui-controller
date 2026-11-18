import type { Attachment } from 'svelte/attachments';
import { cn } from '$lib/utils/cn';
import {
	DEFAULT_TOOLTIP_DELAY,
	DEFAULT_TOOLTIP_GAP,
	type TooltipAlign,
	type TooltipSide
} from './tooltip.constants';
import { tooltipContentClass } from './tooltip.styles';
import { resolveTooltipPlacement } from './tooltip.utils';

export type TooltipOptions = {
	content: string;
	side?: TooltipSide;
	align?: TooltipAlign;
	/** Delay before showing, in ms. Defaults to 0 (instant). */
	delay?: number;
	gap?: number;
	disabled?: boolean;
	/** Show only when the trigger text is truncated (scrollWidth > clientWidth). */
	onlyWhenTruncated?: boolean;
	contentClass?: string;
	onOpenChange?: (open: boolean) => void;
};

let tooltipIdSeq = 0;

/**
 * Instant tooltip as a Svelte attachment — apply on the trigger element:
 *
 * ```svelte
 * <button {@attach tooltip({ content: 'APS', side: 'right' })}>…</button>
 * ```
 */
export function tooltip(options: TooltipOptions): Attachment {
	return (element) => {
		const {
			content,
			side = 'top',
			align = 'center',
			delay = DEFAULT_TOOLTIP_DELAY,
			gap = DEFAULT_TOOLTIP_GAP,
			disabled = false,
			onlyWhenTruncated = false,
			contentClass = '',
			onOpenChange
		} = options;

		if (disabled || !content) {
			return;
		}

		const tooltipId = `ifactory-tooltip-${++tooltipIdSeq}`;
		let tipEl: HTMLDivElement | null = null;
		let open = false;
		let showTimer: ReturnType<typeof setTimeout> | undefined;

		function clearShowTimer() {
			if (showTimer !== undefined) {
				clearTimeout(showTimer);
				showTimer = undefined;
			}
		}

		function updatePosition() {
			if (!tipEl) return;

			const placement = resolveTooltipPlacement({
				preferredSide: side,
				preferredAlign: align,
				triggerRect: element.getBoundingClientRect(),
				contentRect: tipEl.getBoundingClientRect(),
				gap
			});

			tipEl.style.top = `${placement.top}px`;
			tipEl.style.left = `${placement.left}px`;
		}

		function setOpen(next: boolean) {
			if (open === next) return;
			open = next;
			onOpenChange?.(next);

			if (next) {
				tipEl = document.createElement('div');
				tipEl.id = tooltipId;
				tipEl.setAttribute('role', 'tooltip');
				tipEl.className = cn(tooltipContentClass, contentClass);
				tipEl.textContent = content;
				document.body.appendChild(tipEl);
				element.setAttribute('aria-describedby', tooltipId);
				updatePosition();
				return;
			}

			tipEl?.remove();
			tipEl = null;
			element.removeAttribute('aria-describedby');
		}

		function show() {
			clearShowTimer();
			if (onlyWhenTruncated && element.scrollWidth <= element.clientWidth) return;
			if (delay <= 0) {
				setOpen(true);
				return;
			}
			showTimer = setTimeout(() => {
				setOpen(true);
			}, delay);
		}

		function hide() {
			clearShowTimer();
			setOpen(false);
		}

		function onReposition() {
			if (open) updatePosition();
		}

		element.addEventListener('mouseenter', show);
		element.addEventListener('mouseleave', hide);
		element.addEventListener('focusin', show);
		element.addEventListener('focusout', hide);
		window.addEventListener('resize', onReposition);
		window.addEventListener('scroll', onReposition, true);

		return () => {
			clearShowTimer();
			setOpen(false);
			element.removeEventListener('mouseenter', show);
			element.removeEventListener('mouseleave', hide);
			element.removeEventListener('focusin', show);
			element.removeEventListener('focusout', hide);
			window.removeEventListener('resize', onReposition);
			window.removeEventListener('scroll', onReposition, true);
		};
	};
}
