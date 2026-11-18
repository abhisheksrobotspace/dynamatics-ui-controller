// Mock-backed instructions CRUD. Integration note: v1 source is
// cms/items/instructions.
import { mockInstructions } from './instructions.mock.js';
import { clone, mockDelay, nextMockId } from './mock-utils.js';
import type { Instruction } from './types.js';

const instructionsStore: Instruction[] = clone(mockInstructions);

export async function listInstructions(signal?: AbortSignal): Promise<Instruction[]> {
	await mockDelay(signal);
	return clone(instructionsStore);
}

export async function getInstruction(
	id: number,
	signal?: AbortSignal
): Promise<Instruction | null> {
	await mockDelay(signal);
	const instruction = instructionsStore.find((row) => row.id === id);
	return instruction ? clone(instruction) : null;
}

export type SaveInstructionInput = {
	instruction_text: string;
	estimated_duration_minutes: number;
};

export async function createInstruction(
	input: SaveInstructionInput,
	signal?: AbortSignal
): Promise<Instruction> {
	await mockDelay(signal);
	const duplicate = instructionsStore.some(
		(row) => row.instruction_text.toLowerCase() === input.instruction_text.toLowerCase()
	);
	if (duplicate) {
		throw new Error('An instruction with this text already exists.');
	}
	const instruction: Instruction = { id: nextMockId(), ...input };
	instructionsStore.push(instruction);
	return clone(instruction);
}

export async function updateInstruction(
	id: number,
	input: SaveInstructionInput,
	signal?: AbortSignal
): Promise<void> {
	await mockDelay(signal);
	const instruction = instructionsStore.find((row) => row.id === id);
	if (!instruction) throw new Error('Instruction not found.');
	instruction.instruction_text = input.instruction_text;
	instruction.estimated_duration_minutes = input.estimated_duration_minutes;
}

export async function deleteInstruction(id: number, signal?: AbortSignal): Promise<void> {
	await mockDelay(signal);
	const index = instructionsStore.findIndex((row) => row.id === id);
	if (index >= 0) instructionsStore.splice(index, 1);
}
