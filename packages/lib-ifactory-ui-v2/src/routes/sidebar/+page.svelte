<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { PanelLeft } from '@lucide/svelte';
	import {
		Briefcase,
		FolderCog,
		LayoutDashboard,
		LayoutGrid,
		LayoutList,
		PenTool,
		Settings2,
		Ticket,
		UserCog
	} from '@lucide/svelte';
	import { Button, Sidebar } from '$lib';
	import type {
		SidebarNavItem,
		SidebarVariant
	} from '$lib/components/ui/sidebar/sidebar.constants';

	let sidebarOpen = $state(true);
	let variant = $state<SidebarVariant>('light');

	const navItems: SidebarNavItem[] = [
		{ label: 'Dashboard', href: '#', icon: LayoutDashboard, active: true },
		{ label: 'SM Dashboard', href: '#', icon: LayoutGrid },
		{ label: 'Machines', href: '#', icon: Settings2 },
		{ label: 'Production', href: '#', icon: PenTool },
		{ label: 'HMI Jobs', href: '#', icon: Briefcase },
		{ label: 'Jobs', href: '#', icon: Briefcase },
		{ label: 'Tickets', href: '#', icon: Ticket },
		{ label: 'Operators', href: '#', icon: UserCog },
		{ label: 'By MIR', href: '#', icon: FolderCog },
		{ label: 'By Marking', href: '#', icon: LayoutList }
	];
</script>

<DemoBackNav />

<div
	class={variant === 'dark'
		? 'flex min-h-screen overflow-x-hidden bg-gray-950'
		: 'flex min-h-screen overflow-x-hidden bg-background'}
>
	<Sidebar bind:open={sidebarOpen} {variant} collapsible="icon" items={navItems} />

	<main class="flex flex-1 flex-col gap-4 p-8">
		<div class="flex flex-wrap gap-2">
			<Button
				variant="outline"
				icon={PanelLeft}
				label="Toggle sidebar"
				onclick={() => (sidebarOpen = !sidebarOpen)}
			/>
			<Button
				variant="secondary"
				label={variant === 'dark' ? 'Light mode' : 'Dark mode'}
				onclick={() => (variant = variant === 'dark' ? 'light' : 'dark')}
			/>
		</div>
		<p class={variant === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-muted-foreground'}>
			Main content area
		</p>
	</main>
</div>
