import type { Instruction } from './types.js';

export const mockInstructions: Instruction[] = [
	{
		id: 1,
		instruction_text: 'Isolate machine and apply lockout-tagout',
		estimated_duration_minutes: 10
	},
	{
		id: 2,
		instruction_text: 'Inspect drive belt tension and wear',
		estimated_duration_minutes: 15
	},
	{
		id: 3,
		instruction_text: 'Check hydraulic oil level and top up',
		estimated_duration_minutes: 20
	},
	{ id: 4, instruction_text: 'Grease all bearing points', estimated_duration_minutes: 30 },
	{ id: 5, instruction_text: 'Verify emergency stop operation', estimated_duration_minutes: 5 },
	{ id: 6, instruction_text: 'Clean control panel filters', estimated_duration_minutes: 15 },
	{
		id: 7,
		instruction_text: 'Record motor current draw at full load',
		estimated_duration_minutes: 10
	}
];
