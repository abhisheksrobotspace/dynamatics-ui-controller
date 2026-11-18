<script lang="ts">
	/** Safety-shoe glyph from the HMI Figma (no Lucide equivalent). Lucide-compatible 24px grid. */
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
	<path d="M5 3h7v8l5 1.5c2 .6 3 1.6 3 3.5v2H3v-4l2-1z" />
	<path d="M3 18v2h17v-2" />
	<path d="M12 7H9" />
	<path d="M12 11H9" />
</svg>
