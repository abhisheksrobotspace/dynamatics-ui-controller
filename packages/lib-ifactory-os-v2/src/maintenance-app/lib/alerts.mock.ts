import type { AlertMaster } from './types.js';

/**
 * Alert taxonomy fixture. Ids 2/3/13 intentionally match the magic ids in
 * constants.ts (breakdown = 3/13, scheduled = 2).
 */
export const mockAlerts: AlertMaster[] = [
	// Top-level alert categories (alert_group_id 1 = maintenance group)
	{
		id: 2,
		name: 'Scheduled',
		description: 'Planned preventive maintenance',
		parent_id: null,
		is_alert_sub_category: false,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: false
	},
	{
		id: 3,
		name: 'Breakdown',
		description: 'Unplanned machine breakdown',
		parent_id: null,
		is_alert_sub_category: false,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: true
	},
	{
		id: 13,
		name: 'Breakdown - Utility',
		description: 'Breakdown of utility equipment',
		parent_id: null,
		is_alert_sub_category: false,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: true
	},
	{
		id: 4,
		name: 'Quality Issue',
		description: 'Output quality deviation',
		parent_id: null,
		is_alert_sub_category: false,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: true
	},
	{
		id: 5,
		name: 'Safety',
		description: 'Safety observation or incident',
		parent_id: null,
		is_alert_sub_category: false,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: true
	},

	// Sub-categories (parent = top-level alert)
	{
		id: 21,
		name: 'Mechanical',
		description: null,
		parent_id: 3,
		is_alert_sub_category: true,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: false
	},
	{
		id: 22,
		name: 'Electrical',
		description: null,
		parent_id: 3,
		is_alert_sub_category: true,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: false
	},
	{
		id: 23,
		name: 'Hydraulic',
		description: null,
		parent_id: 13,
		is_alert_sub_category: true,
		is_alert_reason: false,
		alert_group_id: 1,
		available_on_hmi: false
	},

	// Reasons (parent = sub-category)
	{
		id: 31,
		name: 'Bearing failure',
		description: null,
		parent_id: 21,
		is_alert_sub_category: false,
		is_alert_reason: true,
		alert_group_id: 1,
		available_on_hmi: false
	},
	{
		id: 32,
		name: 'Belt snapped',
		description: null,
		parent_id: 21,
		is_alert_sub_category: false,
		is_alert_reason: true,
		alert_group_id: 1,
		available_on_hmi: false
	},
	{
		id: 33,
		name: 'Motor overheating',
		description: null,
		parent_id: 22,
		is_alert_sub_category: false,
		is_alert_reason: true,
		alert_group_id: 1,
		available_on_hmi: false
	},
	{
		id: 34,
		name: 'Control fuse blown',
		description: null,
		parent_id: 22,
		is_alert_sub_category: false,
		is_alert_reason: true,
		alert_group_id: 1,
		available_on_hmi: false
	},
	{
		id: 35,
		name: 'Oil leak',
		description: null,
		parent_id: 23,
		is_alert_sub_category: false,
		is_alert_reason: true,
		alert_group_id: 1,
		available_on_hmi: false
	},
	{
		id: 36,
		name: 'Low pressure',
		description: null,
		parent_id: 23,
		is_alert_sub_category: false,
		is_alert_reason: true,
		alert_group_id: 1,
		available_on_hmi: false
	}
];
