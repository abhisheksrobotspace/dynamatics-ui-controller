<script lang="ts">
	/* Figma: HMI FROZEN DESIGN → plate · piece-preview (Start Job 472×530, Job Running 472×288). */
	let {
		title,
		lengthMm,
		widthMm,
		rows = [],
		class: className = '',
		drawingClass = 'h-[186px]'
	}: {
		title: string;
		lengthMm?: number | null;
		widthMm?: number | null;
		rows?: { label: string; value: string }[];
		class?: string;
		drawingClass?: string;
	} = $props();

	/** Sides within this ratio of each other are drawn as a square. */
	const SQUARE_RATIO = 1.2;
	const hasLength = $derived(lengthMm != null && Number.isFinite(lengthMm) && lengthMm > 0);
	const hasWidth = $derived(widthMm != null && Number.isFinite(widthMm) && widthMm > 0);
	/** Length runs across, width up; the shape only shows which side is longer, not the scale. */
	const shape = $derived.by<'horizontal' | 'vertical' | 'square'>(() => {
		if (!hasLength || !hasWidth) return 'horizontal';
		const ratio = lengthMm! / widthMm!;
		if (ratio >= SQUARE_RATIO) return 'horizontal';
		if (ratio <= 1 / SQUARE_RATIO) return 'vertical';
		return 'square';
	});
	/** Fixed drawings sized for the 190 px drawing area: [width, height] px. */
	const SHAPE_PX = {
		horizontal: [260, 80],
		vertical: [76, 124],
		square: [116, 116]
	} as const;
	const shapeWidth = $derived(SHAPE_PX[shape][0]);
	const shapeHeight = $derived(SHAPE_PX[shape][1]);
</script>

<section
	class="flex flex-col gap-3 overflow-hidden rounded-xl border-2 border-[#c3c8cf] bg-white px-6 pt-[22px] font-body text-[#1b2028] {className}"
>
	<p class="m-0 truncate font-heading text-2xl leading-[31px] font-medium text-[#5a616c] uppercase">
		{title}
	</p>

	<div
		class="flex shrink-0 items-center justify-center rounded-lg bg-[#f5f6f8] {drawingClass}"
		data-shape={shape}
	>
		<div class="flex items-end gap-3" aria-hidden="true">
			<div class="flex flex-col" style:width="{shapeWidth}px">
				<!-- Centred and allowed to overflow, so a long label stays over a narrow shape. -->
				<span class="flex justify-center text-xl leading-[26px] font-bold whitespace-nowrap">
					{hasLength ? `${lengthMm} mm` : '—'}
				</span>
				<span class="mt-1 mb-2.5 h-0 border-t-[1.5px] border-[#4b5563]"></span>
				<span
					class="box-border border-2 border-[#4b5563] bg-[#dadde2]"
					style:height="{shapeHeight}px"
				></span>
			</div>
			<span class="flex items-center gap-3" style:height="{shapeHeight}px">
				<span class="h-full w-0 border-l-[1.5px] border-[#4b5563]"></span>
				<span class="text-xl leading-[26px] font-bold whitespace-nowrap">
					{hasWidth ? `${widthMm} mm` : '—'}
				</span>
			</span>
		</div>
	</div>

	{#if rows.length}
		<dl class="m-0 flex flex-col">
			{#each rows as row (row.label)}
				<div
					class="flex h-[52px] items-center justify-between gap-4 border-b border-[#dde1e5] px-1 last:border-b-0"
				>
					<dt class="font-heading text-2xl leading-[31px] font-medium text-[#5a616c]">
						{row.label}
					</dt>
					<dd class="m-0 truncate text-[26px] leading-[33px] font-bold">{row.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</section>
