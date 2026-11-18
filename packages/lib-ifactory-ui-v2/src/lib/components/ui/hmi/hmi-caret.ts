export type HmiCaretOptions = {
	color?: string;
	/** Caret bar width in px. */
	width?: number;
	/** Caret bar height in px — constant, so it doesn't shrink with placeholder-sized empty fields. */
	height?: number;
};

const DEFAULTS: Required<HmiCaretOptions> = { color: '#ff6b2c', width: 4, height: 44 };
const BLINK_MS = 530;

/**
 * Figma HMI caret: a fixed-size bar drawn at the input's cursor instead of the native caret.
 * Use as `use:hmiCaret` or call with an input ref; returns `{ update, destroy }`.
 * The input's parent becomes the positioning context.
 */
export function hmiCaret(input: HTMLInputElement, options: HmiCaretOptions = {}) {
	let opts = { ...DEFAULTS, ...options };
	const parent = input.parentElement;
	const measure = document.createElement('canvas').getContext('2d');
	const caret = document.createElement('span');
	caret.setAttribute('aria-hidden', 'true');
	Object.assign(caret.style, { position: 'absolute', pointerEvents: 'none', display: 'none' });

	if (parent && getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
	parent?.appendChild(caret);

	const previousCaretColor = input.style.caretColor;
	input.style.caretColor = 'transparent';

	let blink: ReturnType<typeof setInterval> | undefined;
	let frame = 0;

	function render() {
		clearInterval(blink);
		if (document.activeElement !== input || !measure) {
			caret.style.display = 'none';
			return;
		}

		const style = getComputedStyle(input);
		measure.font = style.font;
		const end = input.selectionEnd ?? input.value.length;
		const before = input.value.slice(0, end);
		const text = input.type === 'password' ? '•'.repeat(before.length) : before;
		const spacing = (parseFloat(style.letterSpacing) || 0) * text.length;
		const padLeft = parseFloat(style.paddingLeft);
		const textX = measure.measureText(text).width + spacing;
		// On-screen keys set the value and selection in script, which does not scroll the field
		// the way native typing does: keep the cursor in view, then clamp the bar to the box.
		const view = input.clientWidth - padLeft - parseFloat(style.paddingRight) - opts.width;
		if (textX - input.scrollLeft > view) input.scrollLeft = textX - view;
		else if (textX < input.scrollLeft) input.scrollLeft = textX;
		const offset = Math.min(Math.max(textX - input.scrollLeft, 0), Math.max(view, 0));
		const x = input.offsetLeft + parseFloat(style.borderLeftWidth) + padLeft + offset;

		Object.assign(caret.style, {
			display: 'block',
			visibility: 'visible',
			left: `${Math.round(x)}px`,
			top: `${Math.round(input.offsetTop + (input.offsetHeight - opts.height) / 2)}px`,
			width: `${opts.width}px`,
			height: `${opts.height}px`,
			background: opts.color
		});

		blink = setInterval(() => {
			caret.style.visibility = caret.style.visibility === 'hidden' ? 'visible' : 'hidden';
		}, BLINK_MS);
	}

	/** Programmatic writes set the selection after dispatching `input`, so measure next frame. */
	function schedule() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(render);
	}

	function onSelectionChange() {
		if (document.activeElement === input) schedule();
	}

	const events = ['focus', 'blur', 'input', 'click', 'keyup', 'scroll'] as const;
	for (const name of events) input.addEventListener(name, schedule);
	document.addEventListener('selectionchange', onSelectionChange);
	schedule();

	return {
		update(next: HmiCaretOptions = {}) {
			opts = { ...DEFAULTS, ...next };
			schedule();
		},
		destroy() {
			for (const name of events) input.removeEventListener(name, schedule);
			document.removeEventListener('selectionchange', onSelectionChange);
			cancelAnimationFrame(frame);
			clearInterval(blink);
			caret.remove();
			input.style.caretColor = previousCaretColor;
		}
	};
}
