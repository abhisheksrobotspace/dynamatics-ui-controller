<script lang="ts">
	import { Building2, FolderOpen, HardHat } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';
	import { app } from '../app.svelte';

	let { currentRoute = 'Home', open = $bindable(true) } = $props();

	const items = $derived([
		{
			type: 'link' as const,
			label: 'Projects',
			icon: FolderOpen,
			href: '#/ProjectManagement/Home',
			active: currentRoute === 'Home' || currentRoute?.startsWith('Home/')
		},
		{
			type: 'link' as const,
			label: 'Customers',
			icon: Building2,
			href: '#/ProjectManagement/Customers',
			active: currentRoute === 'Customers'
		},
		{
			type: 'link' as const,
			label: 'Contractors',
			icon: HardHat,
			href: '#/ProjectManagement/Contractors',
			active: currentRoute === 'Contractors' || currentRoute?.startsWith('Contractors/')
		}
	]);
</script>

<Sidebar
	bind:open
	collapsible="icon"
	variant="light"
	title={app.displayName}
	titleIcon={FolderOpen}
	{items}
	activeNavItemClass="!border-r-primary !text-primary"
	class="h-full"
/>
