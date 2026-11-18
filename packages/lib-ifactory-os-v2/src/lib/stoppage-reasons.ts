import type { Component } from 'svelte';
import {
	AlertTriangle,
	Brush,
	ClipboardCheck,
	CircleX,
	CalendarX,
	CornerDownRight,
	HardHat,
	PackageX,
	PauseCircle,
	Power,
	SlidersHorizontal,
	Utensils,
	UserX,
	Users,
	Wrench
} from '@lucide/svelte';

export interface StoppageReason {
	/** Button number / layout id — display and inbound fallback only; never publish. */
	id: number;
	/** Wire value for `/iow/*` — `alerts_master.alert_code`. */
	alertCode: string;
	label: string;
	icon: Component<{ class?: string }>;
	/**
	 * From machineSettings. `null` = system reason (no HMI button) — kept in the
	 * loaded catalog for lookup, but filtered out of the picker.
	 */
	buttonNo?: number | null;
	/** From machineSettings reason — machine must not auto-resume until acknowledged. */
	requiresAck?: boolean;
	/** From machineSettings — replaces setup/downtime/maintenance code groups. */
	defaultMachineState?: number;
}

/** Icon / layout fallback for the 16 operator buttons until machineSettings loads. */
export const STOPPAGE_REASONS: StoppageReason[] = [
	{ id: 1, alertCode: 'no_plan', label: 'No Plan', icon: CalendarX, buttonNo: 1 },
	{ id: 2, alertCode: 'clit', label: 'CLIT', icon: Brush, buttonNo: 2 },
	{
		id: 3,
		alertCode: 'breakdown',
		label: 'Breakdown',
		icon: AlertTriangle,
		buttonNo: 3,
		/** Matches typical plant settings; overridden when machineSettings loads. */
		requiresAck: true
	},
	{ id: 4, alertCode: 'setup_change', label: 'Setup Change', icon: SlidersHorizontal, buttonNo: 4 },
	{ id: 5, alertCode: 'tool_change', label: 'Tool Change', icon: Wrench, buttonNo: 5 },
	{ id: 6, alertCode: 'no_power', label: 'No Power', icon: Power, buttonNo: 6 },
	{ id: 7, alertCode: 'no_operator', label: 'No Operator', icon: UserX, buttonNo: 7 },
	{ id: 8, alertCode: 'bend_material', label: 'Bend Material', icon: CornerDownRight, buttonNo: 8 },
	{ id: 9, alertCode: 'no_crane', label: 'No Crane', icon: CircleX, buttonNo: 9 },
	{ id: 10, alertCode: 'no_material', label: 'No Material', icon: PackageX, buttonNo: 10 },
	{ id: 11, alertCode: 'minor_stoppage', label: 'Minor Stoppage', icon: PauseCircle, buttonNo: 11 },
	{ id: 12, alertCode: 'no_tool', label: 'No Tool', icon: Wrench, buttonNo: 12 },
	{
		id: 13,
		alertCode: 'preventive_maintenance',
		label: 'Preventive Maintenance',
		icon: HardHat,
		buttonNo: 13
	},
	{ id: 14, alertCode: 'lunch_dinner', label: 'Lunch/Dinner', icon: Utensils, buttonNo: 14 },
	{ id: 15, alertCode: 'meeting_training', label: 'Meeting/Training', icon: Users, buttonNo: 15 },
	{ id: 16, alertCode: 'inspection', label: 'Inspection', icon: ClipboardCheck, buttonNo: 16 }
];

/** Operator-facing buttons only. System codes (`buttonNo: null`) stay in the catalog for lookup. */
export function isSelectableReason(reason: StoppageReason): boolean {
	return reason.buttonNo != null;
}

export function findStoppageReasonByCode(alertCode: string): StoppageReason | undefined {
	const code = alertCode.trim().toLowerCase();
	if (!code) return undefined;
	return STOPPAGE_REASONS.find((entry) => entry.alertCode === code);
}

export function findStoppageReasonById(id: number): StoppageReason | undefined {
	return STOPPAGE_REASONS.find((entry) => entry.id === id);
}
