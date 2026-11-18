<script lang="ts">
	import { LayoutDashboard, FileText, Settings } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';

	let { currentRoute = 'Home', open = $bindable(true) } = $props();

	const items = $derived([
		{
			type: 'link' as const,
			label: 'Dashboard',
			icon: LayoutDashboard,
			href: '#/SampleApp/Home',
			active: currentRoute === 'Home' || currentRoute?.startsWith('Home/')
		},
		{
			type: 'link' as const,
			label: 'Reports',
			icon: FileText,
			href: '#/SampleApp/Reports',
			active: currentRoute === 'Reports' || currentRoute?.startsWith('Reports/')
		},
		{
			type: 'link' as const,
			label: 'Settings',
			icon: Settings,
			href: '#/SampleApp/Settings',
			active: currentRoute === 'Settings' || currentRoute?.startsWith('Settings/')
		}
	]);
</script>

<Sidebar bind:open collapsible="icon" variant="light" {items} class="h-full" />
