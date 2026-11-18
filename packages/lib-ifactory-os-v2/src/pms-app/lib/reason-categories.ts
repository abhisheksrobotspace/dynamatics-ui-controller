import type { Component } from 'svelte';
import {
	CalendarCog,
	ClipboardX,
	Cog,
	Droplet,
	PackageX,
	Presentation,
	RefreshCcw,
	SearchCheck,
	SlidersHorizontal,
	Timer,
	UserX,
	Utensils,
	WrenchOff,
	ZapOff
} from '@lucide/svelte';
import BendMaterialIcon from '$lib/assets/icons/BendMaterialIcon.svelte';
import NoCraneIcon from '$lib/assets/icons/NoCraneIcon.svelte';
import type { StoppageReason } from '$lib/stoppage-reasons';

export type ReasonIcon = Component<{ class?: string; strokeWidth?: number }>;

/* Figma: HMI FROZEN DESIGN → stop-reason. Tabs and their order, keyed by `alertCode`. */
const CATEGORIES = [
	{
		id: 'most-used',
		label: 'Most used',
		title: 'Most used on this machine',
		codes: [
			'minor_stoppage',
			'tool_change',
			'breakdown',
			'setup_change',
			'no_material',
			'lunch_dinner'
		]
	},
	{
		id: 'machine',
		label: 'Machine',
		title: 'Machine',
		codes: ['breakdown', 'minor_stoppage', 'setup_change', 'tool_change', 'no_tool', 'no_power']
	},
	{
		id: 'material',
		label: 'Material',
		title: 'Material',
		codes: ['no_material', 'bend_material', 'no_crane']
	},
	{
		id: 'people',
		label: 'People',
		title: 'People',
		codes: ['no_operator', 'lunch_dinner', 'meeting_training']
	},
	{
		id: 'planned',
		label: 'Planned',
		title: 'Planned',
		codes: ['no_plan', 'preventive_maintenance', 'inspection', 'clit']
	}
] as const;

const HMI_ICONS: Record<string, ReasonIcon> = {
	no_plan: ClipboardX,
	clit: Droplet,
	breakdown: Cog,
	setup_change: SlidersHorizontal,
	tool_change: RefreshCcw,
	no_power: ZapOff,
	no_operator: UserX,
	bend_material: BendMaterialIcon,
	no_crane: NoCraneIcon,
	no_material: PackageX,
	minor_stoppage: Timer,
	no_tool: WrenchOff,
	preventive_maintenance: CalendarCog,
	lunch_dinner: Utensils,
	meeting_training: Presentation,
	inspection: SearchCheck
};

export type ReasonCategory = {
	id: string;
	label: string;
	title: string;
	reasons: StoppageReason[];
};

/**
 * Splits the machine's selectable reasons into the HMI tabs. Reasons from machineSettings that
 * no tab lists go to an extra "Other" tab so none are hidden.
 */
export function groupReasons(reasons: StoppageReason[]): ReasonCategory[] {
	const byCode = new Map(reasons.map((reason) => [reason.alertCode, reason]));
	const placed = new Set<string>();
	const groups: ReasonCategory[] = CATEGORIES.map((category) => {
		const list = category.codes.flatMap((code) => {
			const reason = byCode.get(code);
			if (!reason) return [];
			if (category.id !== 'most-used') placed.add(code);
			return [reason];
		});
		return { id: category.id, label: category.label, title: category.title, reasons: list };
	});
	const other = reasons.filter((reason) => !placed.has(reason.alertCode));
	if (other.length > 0) {
		groups.push({ id: 'other', label: 'Other', title: 'Other', reasons: other });
	}
	return groups.filter((group) => group.reasons.length > 0);
}

/** HMI glyph for a reason; falls back to the catalog icon for codes the Figma does not cover. */
export function reasonIcon(reason: StoppageReason): ReasonIcon {
	return HMI_ICONS[reason.alertCode] ?? (reason.icon as ReasonIcon);
}

/** "Lunch/Dinner" → "Lunch / Dinner", as on the Figma tiles. */
export function reasonLabel(reason: StoppageReason): string {
	return reason.label.replace(/\s*\/\s*/g, ' / ');
}

/**
 * Figma: HMI FROZEN DESIGN → stop-reason · all reasons (4 × 4, read column by column:
 * machine, maintenance, material, people / plan). Row-major here for a 4-column grid.
 */
const GRID_ORDER = [
	'breakdown',
	'setup_change',
	'no_material',
	'no_operator',
	'minor_stoppage',
	'preventive_maintenance',
	'bend_material',
	'lunch_dinner',
	'tool_change',
	'clit',
	'no_crane',
	'meeting_training',
	'no_tool',
	'inspection',
	'no_power',
	'no_plan'
];

/** The machine's selectable reasons in the HMI grid order; codes the grid does not list go last. */
export function orderReasons(reasons: StoppageReason[]): StoppageReason[] {
	const rank = (reason: StoppageReason) => {
		const index = GRID_ORDER.indexOf(reason.alertCode);
		return index < 0 ? GRID_ORDER.length : index;
	};
	return [...reasons].sort((a, b) => rank(a) - rank(b));
}

/** A reason's number on the reason grid (1…n, grid order); null when it is not on the grid. */
export function reasonNumber(reason: StoppageReason, reasons: StoppageReason[]): number | null {
	const index = orderReasons(reasons).findIndex((entry) => entry.alertCode === reason.alertCode);
	return index < 0 ? null : index + 1;
}
