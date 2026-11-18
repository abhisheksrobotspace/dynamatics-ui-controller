<script lang="ts">
	import { Factory, Cog, ChartColumn, Briefcase, Ticket, Users, Search } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';
	import { app } from '../app.svelte';

	let { currentRoute = 'Home', open = $bindable(true) } = $props();

	const items = $derived([
		{
			type: 'link' as const,
			label: 'Dashboard',
			icon: Factory,
			href: '#/PMS/Dashboard',
			active:
				currentRoute === 'Home' ||
				currentRoute === 'Dashboard' ||
				currentRoute?.startsWith('Dashboard/')
		},
		{
			type: 'link' as const,
			label: 'Machines',
			icon: Cog,
			href: '#/PMS/Machines',
			active: currentRoute === 'Machines' || currentRoute?.startsWith('Machines/')
		},
		{
			type: 'link' as const,
			label: 'Production',
			icon: ChartColumn,
			href: '#/PMS/Production',
			active: currentRoute === 'Production' || currentRoute?.startsWith('Production/')
		},
		{
			type: 'group' as const,
			label: 'Jobs',
			icon: Briefcase,
			defaultOpen: true,
			items: [
				{
					label: 'HMI Jobs',
					href: '#/PMS/HMIJobs',
					active: currentRoute === 'HMIJobs'
				},
				{
					label: 'Jobs',
					href: '#/PMS/Jobs',
					active: currentRoute === 'Jobs'
				}
			]
		},
		{
			type: 'link' as const,
			label: 'Tickets',
			icon: Ticket,
			href: '#/PMS/Tickets',
			active: currentRoute === 'Tickets' || currentRoute?.startsWith('Tickets/')
		},
		{
			type: 'link' as const,
			label: 'Operators',
			icon: Users,
			href: '#/PMS/Operators',
			active: currentRoute === 'Operators'
		},
		{
			type: 'link' as const,
			label: 'Search by MIR',
			icon: Search,
			href: '#/PMS/SearchByMir',
			active: currentRoute === 'SearchByMir' || currentRoute?.startsWith('SearchByMir/')
		},
		{
			type: 'link' as const,
			label: 'Search by Marking',
			icon: Search,
			href: '#/PMS/SearchByMarking',
			active: currentRoute === 'SearchByMarking'
		}
	]);
</script>

<Sidebar
	bind:open
	collapsible="icon"
	variant="light"
	title={app.displayName}
	titleIcon={Factory}
	{items}
	activeNavItemClass="!border-r-primary !text-primary"
	class="h-full"
/>
