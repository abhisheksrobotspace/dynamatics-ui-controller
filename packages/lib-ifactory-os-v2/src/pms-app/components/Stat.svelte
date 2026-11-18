<script lang="ts">
	import { KeyValueCard } from '@ifactory/ui-v2';

	type Props = {
		label: string;
		value: string | number;
		tone?: 'primary' | 'neutral' | 'online' | 'error' | 'muted';
		size?: 'hero' | 'sm';
		class?: string;
		labelClass?: string;
		valueClass?: string;
	};

	let {
		label,
		value,
		tone = 'neutral',
		size = 'hero',
		class: className = '',
		labelClass = '',
		valueClass = ''
	}: Props = $props();

	const toneColor = $derived.by(() => {
		switch (tone) {
			case 'primary':
				return 'text-primary';
			case 'online':
				return 'text-status-online';
			case 'error':
				return 'text-status-error';
			case 'muted':
				return 'text-muted';
			case 'neutral':
			default:
				return 'text-foreground';
		}
	});

	const isSm = $derived(size === 'sm');
</script>

<KeyValueCard
	{label}
	value={String(value)}
	class="box-border flex min-h-0 w-full flex-col items-start justify-between overflow-hidden border-0 bg-transparent p-0 shadow-none {isSm
		? 'h-[58.4px]'
		: 'h-full'} {className}"
	labelClass="font-heading text-sm font-bold uppercase tracking-[0.35px] text-muted {labelClass}"
	valueClass="max-w-full overflow-hidden font-body font-bold tabular-nums whitespace-nowrap {toneColor} {isSm
		? 'text-[28px] leading-[36px]'
		: 'text-[95px] leading-[95px]'} {valueClass}"
/>
