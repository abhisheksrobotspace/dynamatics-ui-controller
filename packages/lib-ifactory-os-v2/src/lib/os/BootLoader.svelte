<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { base } from '$app/paths';

	let {
		complete = false,
		onfinished
	}: {
		complete?: boolean;
		onfinished?: () => void;
	} = $props();

	let progress = $state(0);
	let progressIntervalId: ReturnType<typeof setInterval>;
	let hasFinished = $state(false);

	function finishLoader() {
		if (hasFinished) {
			return;
		}

		hasFinished = true;
		progress = 100;
		clearInterval(progressIntervalId);
		if (onfinished) {
			onfinished();
		}
	}

	onMount(() => {
		progress = 0;
		hasFinished = false;

		progressIntervalId = setInterval(() => {
			if (complete) {
				progress = Math.min(progress + 8, 100);
				if (progress >= 100) {
					finishLoader();
				}
				return;
			}

			progress = Math.min(progress + 1.8, 90);
		}, 1);
	});

	onDestroy(() => {
		progress = 100;
		clearInterval(progressIntervalId);
	});
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-[#222222]"
	role="status"
	aria-label="Loading iFactory OS"
>
	<div
		class="flex w-[min(28.819vw,415px)] min-w-[260px] translate-y-[-7px] flex-col items-center gap-[58px]"
	>
		<img
			src="{base}/assets/icons/rs-logo-on-loading.svg"
			alt="iFactory OS"
			class="h-[58px] w-[58px]"
		/>
		<div class="h-[5px] w-full overflow-hidden bg-[#666666]" aria-hidden="true">
			<div class="h-full bg-[#FF6C2E]" style={`width: ${progress}%`}></div>
		</div>
	</div>
</div>
