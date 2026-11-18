<script lang="ts">
	import { Cpu, Factory, MapPin, Settings2, Timer } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';

	let { currentRoute = 'Plants', open = $bindable(true) } = $props();

	const items = $derived([
		{
			type: 'link' as const,
			label: 'Plants',
			icon: Factory,
			href: '#/AssetManager/Plants',
			active:
				currentRoute === 'Home' || currentRoute === 'Plants' || currentRoute?.startsWith('Plants/')
		},
		{
			type: 'link' as const,
			label: 'Locations',
			icon: MapPin,
			href: '#/AssetManager/Locations',
			active: currentRoute === 'Locations' || currentRoute?.startsWith('Locations/')
		},
		{
			type: 'link' as const,
			label: 'Machines',
			icon: Cpu,
			href: '#/AssetManager/Machines',
			active: currentRoute === 'Machines'
		},
		{
			type: 'link' as const,
			label: 'Machines Config',
			icon: Settings2,
			href: '#/AssetManager/MachinesConfig',
			active: currentRoute === 'MachinesConfig'
		},
		{
			type: 'link' as const,
			label: 'Transfer Time Configurations',
			icon: Timer,
			href: '#/AssetManager/TransferTimes',
			active: currentRoute === 'TransferTimes' || currentRoute?.startsWith('TransferTimes/')
		}
	]);
</script>

<Sidebar
	bind:open
	collapsible="icon"
	variant="light"
	title="Asset Manager"
	titleIcon={Factory}
	{items}
	activeNavItemClass="!border-r-primary !text-primary"
	class="h-full"
/>
