export type BreadcrumbSeparator = 'slash' | 'chevron';

export type BreadcrumbItem = {
	label: string;
	href?: string;
	current?: boolean;
};

export const defaultBreadcrumbItems: BreadcrumbItem[] = [
	{ label: 'PMS', href: '#' },
	{ label: 'Dashboard', current: true }
];
