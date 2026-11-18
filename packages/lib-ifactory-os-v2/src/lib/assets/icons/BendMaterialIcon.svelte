<script lang="ts">
	/** Bent-section glyph from the HMI Figma (no Lucide equivalent). Lucide-compatible 24px grid. */
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
	<path d="M4 3v15a3 3 0 0 0 3 3h14" />
	<path d="M8 3v10a4 4 0 0 0 4 4h9" />
</svg>
