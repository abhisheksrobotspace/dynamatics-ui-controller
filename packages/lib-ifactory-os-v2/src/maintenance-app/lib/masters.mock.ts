import type { AssetRef, MachineGroup, Shift, TicketFile, UserRef } from './types.js';

export const mockMachineGroups: MachineGroup[] = [
	{ id: 1, name: 'CNC Machines' },
	{ id: 2, name: 'Press Line' },
	{ id: 3, name: 'Galvanizing' }
];

export const mockAssets: AssetRef[] = [
	{
		id: 101,
		display_id: 'CNC-01',
		name: 'CNC Angle Line 1',
		model_no: 'AL-2040',
		factory_id: 1,
		machine_group_id: 1
	},
	{
		id: 102,
		display_id: 'CNC-02',
		name: 'CNC Angle Line 2',
		model_no: 'AL-2040',
		factory_id: 1,
		machine_group_id: 1
	},
	{
		id: 103,
		display_id: 'PLM-01',
		name: 'Plate Punching Machine',
		model_no: 'PP-880',
		factory_id: 1,
		machine_group_id: 2
	},
	{
		id: 104,
		display_id: 'PRS-01',
		name: 'Hydraulic Press 250T',
		model_no: 'HP-250',
		factory_id: 1,
		machine_group_id: 2
	},
	{
		id: 105,
		display_id: 'GLV-01',
		name: 'Galvanizing Kettle',
		model_no: 'GK-9',
		factory_id: 1,
		machine_group_id: 3
	},
	{
		id: 106,
		display_id: 'CRN-01',
		name: 'EOT Crane 10T',
		model_no: 'EOT-10',
		factory_id: 1,
		machine_group_id: 3
	}
];

export const mockUsers: UserRef[] = [
	{ id: 1, first_name: 'Ravi', last_name: 'Kumar' },
	{ id: 2, first_name: 'Sunita', last_name: 'Patil' },
	{ id: 3, first_name: 'Mohan', last_name: 'Das' },
	{ id: 4, first_name: 'Ayesha', last_name: 'Khan' }
];

/** Manuals per asset id; urls are placeholders until the files backend lands. */
export const mockAssetManuals: Record<number, TicketFile[]> = {
	101: [
		{
			id: 'manual-al-2040',
			name: 'AL-2040 Operating Manual.pdf',
			type: 'application/pdf',
			size: 2_400_000,
			url: '#'
		}
	],
	104: [
		{
			id: 'manual-hp-250',
			name: 'HP-250 Hydraulic Press Service Guide.pdf',
			type: 'application/pdf',
			size: 5_100_000,
			url: '#'
		}
	]
};

export const mockShifts: Shift[] = [
	{ id: 1, name: 'Shift A', start_time: '06:00:00', end_time: '14:00:00' },
	{ id: 2, name: 'Shift B', start_time: '14:00:00', end_time: '22:00:00' },
	{ id: 3, name: 'Shift C', start_time: '22:00:00', end_time: '06:00:00' }
];
