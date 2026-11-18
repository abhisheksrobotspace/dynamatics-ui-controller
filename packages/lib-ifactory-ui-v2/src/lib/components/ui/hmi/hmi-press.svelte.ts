import { HMI_PRESS_MIN_MS } from './hmi.constants';

type PressTarget = EventTarget & { disabled?: boolean };

/**
 * Touch-safe pressed state. CSS `:active` on a touchscreen lasts only as long as the finger
 * (often a few ms on a quick tap), so the pressed look is driven from pointer events and held
 * for at least {@link HMI_PRESS_MIN_MS}. Spread `handlers` on the element (works on `Button`)
 * and switch classes on `pressed`.
 */
export function createHmiPress(minMs = HMI_PRESS_MIN_MS) {
	let pressed = $state(false);
	let pressedAt = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function down(event: PointerEvent) {
		if ((event.currentTarget as PressTarget | null)?.disabled) return;
		clearTimeout(timer);
		pressed = true;
		pressedAt = performance.now();
	}

	function up() {
		if (!pressed) return;
		const remaining = minMs - (performance.now() - pressedAt);
		clearTimeout(timer);
		timer = setTimeout(() => (pressed = false), Math.max(0, remaining));
	}

	return {
		get pressed() {
			return pressed;
		},
		handlers: {
			onpointerdown: down,
			onpointerup: up,
			onpointerleave: up,
			onpointercancel: up
		}
	};
}

export type HmiPress = ReturnType<typeof createHmiPress>;
