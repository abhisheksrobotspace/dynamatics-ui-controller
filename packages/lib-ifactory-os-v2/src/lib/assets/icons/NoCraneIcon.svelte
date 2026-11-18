<script lang="ts">
	/** Crane hook with a strike-through, from the HMI Figma (no Lucide equivalent). 24px grid. */
	let { class: className = '', strokeWidth = 2 }: { class?: string; strokeWidth?: number } =
		$props();
</script>

<svg
	class={className}
	width="24"
	height="24"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<path d="M2 3h20" />
	<path d="M9 3v4h6V3" />
	<path d="M12 7v6" />
	<path d="M12 13a2 2 0 1 1-2 2" />
	<path d="M21 6 3 21" />
</svg>
