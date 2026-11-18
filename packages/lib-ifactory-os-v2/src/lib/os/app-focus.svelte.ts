import { appsRunning, currentActiveAppId } from './index.svelte.js';

/** True when this OS window is focused and not minimised. */
export function isOsAppInstanceFocused(appInstanceId: string): boolean {
	const id = currentActiveAppId.appId;
	if (!id || id !== appInstanceId) return false;
	const running = appsRunning[id];
	return Boolean(running && !running.minimised);
}
