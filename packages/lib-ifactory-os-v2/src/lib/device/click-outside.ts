export type ClickOutsideException = Node | null | undefined | string;

function matchesException(target: Node, exception: ClickOutsideException): boolean {
	if (exception == null) {
		return false;
	}

	if (typeof exception === 'string') {
		return target instanceof Element && target.closest(exception) !== null;
	}

	return exception.contains(target);
}

export function isClickOutside(event: PointerEvent, exceptions: ClickOutsideException[]): boolean {
	const target = event.target;
	if (!(target instanceof Node)) {
		return false;
	}

	return !exceptions.some((exception) => matchesException(target, exception));
}

/** Returns cleanup — use as an `$effect` return value. */
export function clickOutside(
	exceptions: ClickOutsideException[] | (() => ClickOutsideException[]),
	onOutside: (event: PointerEvent) => void
): () => void {
	const getExceptions = typeof exceptions === 'function' ? exceptions : () => exceptions;

	const onPointerDown = (event: PointerEvent) => {
		if (!isClickOutside(event, getExceptions())) {
			return;
		}

		onOutside(event);
	};

	document.addEventListener('pointerdown', onPointerDown);

	return () => {
		document.removeEventListener('pointerdown', onPointerDown);
	};
}
