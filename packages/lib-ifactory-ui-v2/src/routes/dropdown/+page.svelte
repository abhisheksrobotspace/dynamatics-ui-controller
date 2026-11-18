<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import {
		BarChart3,
		Check,
		CircleHelp,
		CloudCog,
		Globe,
		SlidersHorizontal,
		UserRound
	} from '@lucide/svelte';
	import { DropdownMenu } from '$lib';
	import { DEFAULT_DROPDOWN_MAX_HEIGHT } from '$lib/components/ui/dropdown-menu';
	import type { DropdownMenuItem } from '$lib/components/ui/dropdown-menu';

	const user = {
		name: 'John Doe',
		email: 'johndoe@gmail.com',
		avatarSrc: 'https://api.dicebear.com/9.x/avataaars/svg?seed=John'
	};

	const menuGroups: DropdownMenuItem[][] = [
		[
			{ label: 'Settings', icon: SlidersHorizontal, shortcut: 'Shift + P' },
			{ label: 'Language', icon: Globe, trailing: 'EN >' },
			{ label: 'Help Center', icon: CircleHelp }
		],
		[
			{ label: 'Account', icon: UserRound, trailing: 'EN >' },
			{ label: 'Updates', icon: CloudCog, trailing: 'EN >' },
			{ label: 'Task Manager', icon: BarChart3 }
		],
		[{ label: 'Log Out', icon: Check }]
	];

	const languageOptions: DropdownMenuItem[] = [
		{ label: 'English', value: 'en' },
		{ label: 'Hindi', value: 'hi' },
		{ label: 'Spanish', value: 'es' },
		{ label: 'French', value: 'fr' },
		{ label: 'German', value: 'de' },
		{ label: 'Japanese', value: 'ja' },
		{ label: 'Korean', value: 'ko' },
		{ label: 'Portuguese', value: 'pt' },
		{ label: 'Italian', value: 'it' },
		{ label: 'Arabic', value: 'ar' },
		{ label: 'Chinese (Simplified)', value: 'zh-cn' },
		{ label: 'Chinese (Traditional)', value: 'zh-tw' }
	];

	const machineFilterOptions: DropdownMenuItem[] = [
		{ label: 'All Machines', value: 'all' },
		{ label: 'CNC Machines', value: 'cnc' },
		{ label: 'CNC Angle Punching', value: 'cnc-angle-punching' },
		{ label: 'CNC Plate Punching', value: 'cnc-plate-punching' },
		{ label: 'Bending', value: 'bending' },
		{ label: 'Notching', value: 'notching' },
		{ label: 'PAG', value: 'pag' },
		{ label: 'Heel Cutting', value: 'heel-cutting' },
		{ label: 'CNC Plasma Cutting', value: 'cnc-plasma-cutting' }
	];

	const machineOptions: DropdownMenuItem[] = Array.from({ length: 24 }, (_, index) => ({
		label: `CP${String(index + 1).padStart(2, '0')}`,
		value: `cp${String(index + 1).padStart(2, '0')}`
	}));

	let selectedLanguage = $state('en');
	let selectedMachine = $state('cp03');
	let selectedMachineFilter = $state('all');
</script>

<DemoBackNav />

<div class="flex min-h-screen overflow-x-hidden bg-background">
	<aside class="flex w-60 flex-col justify-between border-r border-border bg-surface p-4">
		<p class="text-sm font-semibold text-foreground">Sidebar</p>

		<DropdownMenu {user} groups={menuGroups} side="top" align="start" showChevron />
	</aside>

	<main class="flex flex-1 flex-col gap-8 p-8">
		<section class="space-y-4">
			<h1 class="text-2xl font-semibold">Dropdown Menu</h1>
			<p class="max-w-xl text-sm text-muted-foreground">
				Lightweight custom dropdown with scrollable menus, selected-state highlighting, and check
				indicators.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-xl font-semibold">With trigger label</h2>
			<DropdownMenu
				{user}
				groups={menuGroups}
				side="bottom"
				align="start"
				triggerLabel={user.name}
			/>
		</section>

		<section class="space-y-4">
			<h2 class="text-xl font-semibold">With chevron</h2>
			<p class="text-sm text-muted-foreground">
				Chevron points toward the menu — up when closed (menu opens above), down when open.
			</p>
			<DropdownMenu
				{user}
				groups={menuGroups}
				side="bottom"
				align="end"
				triggerLabel={user.name}
				showChevron
			/>
		</section>

		<section class="space-y-4">
			<h2 class="text-xl font-semibold">Machine filter</h2>
			<p class="text-sm text-muted-foreground">
				Filter column trigger with open-state highlight, checkmark selection, and a menu that grows
				with content.
			</p>
			<DropdownMenu
				groups={[
					machineFilterOptions.map((option) => ({
						...option,
						onclick: () => {
							if (option.value) {
								selectedMachineFilter = option.value;
							}
						}
					}))
				]}
				side="bottom"
				align="start"
				triggerLabel="CNC Machines"
				showChevron
				selectedValue={selectedMachineFilter}
				maxHeight="16rem"
			/>
		</section>

		<section class="space-y-4">
			<h2 class="text-xl font-semibold">Selected option</h2>
			<p class="text-sm text-muted-foreground">
				Selected: {selectedLanguage.toUpperCase()}
			</p>
			<DropdownMenu
				groups={[
					languageOptions.map((option) => ({
						...option,
						onclick: () => {
							if (option.value) {
								selectedLanguage = option.value;
							}
						}
					}))
				]}
				side="bottom"
				align="start"
				triggerLabel="Language"
				showChevron
				selectedValue={selectedLanguage}
				maxHeight="12rem"
			/>
		</section>

		<section class="space-y-4">
			<h2 class="text-xl font-semibold">Scrollable list</h2>
			<p class="text-sm text-muted-foreground">
				Selected machine: {selectedMachine.toUpperCase()}. Menu width matches the trigger; pass
				<code class="text-xs">maxHeight</code> to enable scrolling (default constant:
				{DEFAULT_DROPDOWN_MAX_HEIGHT}).
			</p>
			<DropdownMenu
				groups={[
					machineOptions.map((option) => ({
						...option,
						onclick: () => {
							selectedMachine = option.value ?? option.label;
						}
					}))
				]}
				side="bottom"
				align="start"
				triggerLabel={selectedMachine.toUpperCase()}
				showChevron
				selectedValue={selectedMachine}
				maxHeight={DEFAULT_DROPDOWN_MAX_HEIGHT}
			/>
		</section>
	</main>
</div>
