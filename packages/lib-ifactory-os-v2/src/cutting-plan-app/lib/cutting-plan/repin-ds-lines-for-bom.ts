import {
	isDeliveryScheduleEditable,
	listDeliveryScheduleLinesByIds,
	listDeliverySchedules,
	updateDeliveryScheduleLine
} from '../../../project-management-app/lib/projects/delivery-schedules.api.js';

export type RepinDsLinesResult = {
	updated: number;
	alreadyPinned: number;
	skippedFrozenSchedules: number;
	lineCount: number;
};

/**
 * Point this project's delivery-schedule lines for `bomId` at `runId` so
 * `inv_ds_requirements` (and Assign & Lock) read the new cutting-plan bars.
 * Skips frozen schedules.
 */
export async function repinDeliveryScheduleLinesForBom(input: {
	projectId: string;
	bomId: string;
	runId: string;
	signal?: AbortSignal;
}): Promise<RepinDsLinesResult> {
	const schedules = await listDeliverySchedules(input.projectId, input.signal);
	const editableIds = schedules.filter(isDeliveryScheduleEditable).map((schedule) => schedule.id);
	const skippedFrozenSchedules = schedules.length - editableIds.length;

	const lines = await listDeliveryScheduleLinesByIds(editableIds, input.signal);
	const targets = lines.filter((line) => line.bom_id === input.bomId);

	let updated = 0;
	let alreadyPinned = 0;

	for (const line of targets) {
		if ((line.cp_run_id ?? null) === input.runId) {
			alreadyPinned += 1;
			continue;
		}
		await updateDeliveryScheduleLine(
			line.delivery_schedule_line_id,
			{
				quantity: line.quantity,
				unit: line.unit,
				description: line.description ?? '',
				cpRunId: input.runId
			},
			input.signal
		);
		updated += 1;
	}

	return {
		updated,
		alreadyPinned,
		skippedFrozenSchedules,
		lineCount: targets.length
	};
}
