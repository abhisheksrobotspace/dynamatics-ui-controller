<script lang="ts">
	import { HmiFlatButton } from '@ifactory/ui-v2';
	import { X } from '@lucide/svelte';
	import { flavor } from '$osFlavor';
	import {
		appsRunning,
		bringAppToFront,
		canCloseApp,
		currentActiveAppId,
		removeApp
	} from './index.svelte';

	/**
	 * HMI (ioware) close key for an app's own header: closes the app in front and goes back to
	 * Home. 72 × 56 in a 56 px title row, 8 px under the top bar and 28 px from the right edge,
	 * the same in every app.
	 * Renders nothing on the web OS or when the app in front cannot be closed (Home / PMS).
	 */
	let { class: className = '' }: { class?: string } = $props();

	const closableAppId = $derived.by(() => {
		if (flavor.id !== 'ioware') return null;
		const id = currentActiveAppId.appId;
		const app = id ? appsRunning[id] : undefined;
		return app && !app.minimised && canCloseApp(app) ? id : null;
	});

	function closeApp() {
		if (!closableAppId) return;
		removeApp(closableAppId);
		const home = Object.values(appsRunning).find((app) => !canCloseApp(app));
		if (home) bringAppToFront(home.appName);
	}
</script>

{#if closableAppId}
	<HmiFlatButton
		size="xs"
		icon={X}
		aria-label="Close app"
		title="Close"
		class="w-[72px] shrink-0 {className}"
		iconClass="size-8"
		onclick={closeApp}
	/>
{/if}
