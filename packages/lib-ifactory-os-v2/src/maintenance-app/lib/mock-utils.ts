/**
 * Shared helpers for the mock API layer. Screens are written against the
 * async `*.api.ts` signatures; when the real backend integration lands,
 * only the api module internals change (see plan: screens first, mocks now).
 */

/** Simulates network latency and honours AbortSignal like a real fetch. */
export function mockDelay(signal?: AbortSignal, ms = 150): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(new DOMException('Aborted', 'AbortError'));
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

/** Structured clone so callers can't mutate the mock stores directly. */
export function clone<T>(value: T): T {
	return structuredClone(value);
}

let nextIdCounter = 5000;

/** Monotonic id generator for rows created during the mock session. */
export function nextMockId(): number {
	nextIdCounter += 1;
	return nextIdCounter;
}
