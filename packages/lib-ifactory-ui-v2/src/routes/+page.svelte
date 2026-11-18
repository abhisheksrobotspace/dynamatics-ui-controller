<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CalendarRange,
		ChevronRight,
		LayoutPanelTop,
		PanelLeft,
		Table,
		TableProperties,
		TextCursorInput,
		Hash,
		ChevronDown,
		ListTree,
		ToggleLeft,
		LayoutTemplate,
		ListFilter,
		MousePointerClick,
		SquareCheck,
		Rows3,
		Bell,
		Inbox,
		GitBranch,
		FolderTree,
		TriangleAlert,
		Keyboard as KeyboardIcon,
		Columns3,
		LayoutGrid,
		Images
	} from '@lucide/svelte';
	import type { Component } from 'svelte';

	interface ShowcaseItem {
		title: string;
		description: string;
		href:
			| '/sidebar'
			| '/components'
			| '/button'
			| '/input'
			| '/checkbox'
			| '/accordion'
			| '/accordion-with-table'
			| '/dropdown'
			| '/combobox'
			| '/breadcrumb'
			| '/tabs'
			| '/toggle'
			| '/dialog'
			| '/date-range-picker'
			| '/table'
			| '/data-table'
			| '/tree-table'
			| '/toast'
			| '/empty-state'
			| '/image-viewer'
			| '/alert'
			| '/progress-bar'
			| '/keyboard'
			| '/metric-row'
			| '/card'
			| '/kanban'
			| '/hmi';
		icon: Component<{ class?: string }>;
	}

	const components: ShowcaseItem[] = [
		{
			title: 'Sidebar',
			description: 'Collapsible navigation with icon and offcanvas modes',
			href: '/sidebar',
			icon: PanelLeft
		},
		{
			title: 'Input, Label & Avatar',
			description: 'Form controls and user avatar display',
			href: '/components',
			icon: TextCursorInput
		},
		{
			title: 'Input',
			description: 'Text inputs and number steppers with increment/decrement controls',
			href: '/input',
			icon: Hash
		},
		{
			title: 'HMI components',
			description: 'ioWare touch keyboard, numpad, search select, data card and hold button',
			href: '/hmi',
			icon: KeyboardIcon
		},
		{
			title: 'Keyboard',
			description: 'Touch-friendly on-screen keyboard for HMI text entry',
			href: '/keyboard',
			icon: KeyboardIcon
		},
		{
			title: 'Metric Row',
			description: 'Title + data-driven metric columns with optional quantity stepper',
			href: '/metric-row',
			icon: Rows3
		},
		{
			title: 'Card',
			description: 'Standard cards: details grid, key-value, status metrics, KPI strips, and more',
			href: '/card',
			icon: LayoutGrid
		},
		{
			title: 'Button',
			description: 'Variants, sizes, icons, loading, and link buttons',
			href: '/button',
			icon: MousePointerClick
		},
		{
			title: 'Checkbox',
			description: 'Checked, indeterminate, and labeled checkbox inputs',
			href: '/checkbox',
			icon: SquareCheck
		},
		{
			title: 'Accordion',
			description: 'Expandable sections with single or multiple open panels',
			href: '/accordion',
			icon: Rows3
		},
		{
			title: 'Accordion With Table',
			description: 'Expandable panels with embedded data tables',
			href: '/accordion-with-table',
			icon: Table
		},
		{
			title: 'Dropdown Menu',
			description: 'Contextual menus with keyboard navigation',
			href: '/dropdown',
			icon: ChevronDown
		},
		{
			title: 'Combobox',
			description: 'Searchable dropdown with optional multi-select',
			href: '/combobox',
			icon: ListFilter
		},
		{
			title: 'Breadcrumb',
			description: 'Navigation trail with overflow-based ellipsis collapse',
			href: '/breadcrumb',
			icon: ListTree
		},
		{
			title: 'Tabs',
			description: 'Underline and segmented tab variants',
			href: '/tabs',
			icon: LayoutPanelTop
		},
		{
			title: 'Toggle',
			description: 'On/off switch with animated thumb and native checkbox semantics',
			href: '/toggle',
			icon: ToggleLeft
		},
		{
			title: 'Dialog',
			description: 'Alert, confirmation, and panel dialogs',
			href: '/dialog',
			icon: LayoutTemplate
		},
		{
			title: 'Date Range Picker',
			description: 'Dual-calendar range selection with optional time and shift presets',
			href: '/date-range-picker',
			icon: CalendarRange
		},
		{
			title: 'Table',
			description: 'Sortable data table with row selection and loading skeleton',
			href: '/table',
			icon: Table
		},
		{
			title: 'DataTable',
			description: 'Full-featured table with pagination, export, selection, and loading skeleton',
			href: '/data-table',
			icon: TableProperties
		},
		{
			title: 'TreeTable',
			description: 'Hierarchical expandable rows with tree column, actions, and loading skeleton',
			href: '/tree-table',
			icon: FolderTree
		},
		{
			title: 'Toast',
			description: 'Notification panels with icons, avatars, and action buttons',
			href: '/toast',
			icon: Bell
		},
		{
			title: 'Empty State',
			description: 'Simple and dashed-border empty states',
			href: '/empty-state',
			icon: Inbox
		},
		{
			title: 'Image Viewer',
			description: 'Zoom, pan, and slide through a list of images',
			href: '/image-viewer',
			icon: Images
		},
		{
			title: 'Alert',
			description: 'Success, warning, error, and info feedback alerts',
			href: '/alert',
			icon: TriangleAlert
		},
		{
			title: 'Progress Bar',
			description: 'Panels, circles, vertical, and bullet step indicators',
			href: '/progress-bar',
			icon: GitBranch
		},
		{
			title: 'Kanban',
			description: 'Drag-and-drop board with columns and cards',
			href: '/kanban',
			icon: Columns3
		}
	];
</script>

<div class="min-h-screen bg-background">
	<header class="border-b border-border">
		<div class="mx-auto max-w-5xl px-6 py-14 text-center">
			<p class="text-sm font-medium tracking-widest text-primary uppercase">iFactory UI v2</p>
			<h1 class="mt-3 text-4xl font-bold tracking-tight">Component Showcase</h1>
			<p class="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
				Explore the design system — pick a component to see it in action.
			</p>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-12">
		<div class="grid gap-4 sm:grid-cols-2">
			{#each components as { title, description, href, icon: Icon } (href)}
				<a
					href={resolve(href)}
					class="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-md"
				>
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white"
					>
						<Icon class="size-5" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-2">
							<h2 class="font-semibold text-foreground">{title}</h2>
							<ChevronRight
								class="size-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
								aria-hidden="true"
							/>
						</div>
						<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
					</div>
				</a>
			{/each}
		</div>
	</main>
</div>
