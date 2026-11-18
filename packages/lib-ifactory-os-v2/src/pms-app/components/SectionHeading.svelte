<script lang="ts">
	import { StatusBar } from '@ifactory/ui-v2';

	type Props = {
		title: string;
		description?: string;
		class?: string;
		titleClass?: string;
		descriptionClass?: string;
	};

	let {
		title,
		description,
		class: className = '',
		titleClass = '',
		descriptionClass = ''
	}: Props = $props();
</script>

{#if description}
	<div class="box-border flex flex-col justify-between border-0 bg-transparent p-0 {className}">
		<h2 class="font-heading text-lg font-bold leading-[25px] text-foreground {titleClass}">
			{title}
		</h2>
		<p
			class="mt-1 font-heading text-base font-bold leading-6 text-muted-foreground {descriptionClass}"
		>
			{description}
		</p>
	</div>
{:else}
	<div class="relative flex h-[33px] w-full items-center justify-center {className}">
		<div class="flex items-center gap-[18px]">
			<StatusBar
				segments={['primary']}
				size="default"
				class="!h-[33px] !w-[5px] !gap-0 shrink-0 overflow-hidden rounded-none"
			/>
			<h1
				class="font-heading text-[25px] font-bold leading-[33px] tracking-normal text-foreground {titleClass}"
			>
				{title}
			</h1>
		</div>
	</div>
{/if}
