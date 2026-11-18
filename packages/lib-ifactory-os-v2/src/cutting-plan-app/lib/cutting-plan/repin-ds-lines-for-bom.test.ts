import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../project-management-app/lib/projects/delivery-schedules.api.js', () => ({
	isDeliveryScheduleEditable: (schedule: { status?: string }) =>
		String(schedule.status ?? '').toLowerCase() !== 'frozen',
	listDeliverySchedules: vi.fn(),
	listDeliveryScheduleLinesByIds: vi.fn(),
	updateDeliveryScheduleLine: vi.fn()
}));

const { listDeliverySchedules, listDeliveryScheduleLinesByIds, updateDeliveryScheduleLine } =
	await import('../../../project-management-app/lib/projects/delivery-schedules.api.js');
const { repinDeliveryScheduleLinesForBom } = await import('./repin-ds-lines-for-bom.js');

describe('repinDeliveryScheduleLinesForBom', () => {
	beforeEach(() => {
		vi.mocked(listDeliverySchedules).mockReset();
		vi.mocked(listDeliveryScheduleLinesByIds).mockReset();
		vi.mocked(updateDeliveryScheduleLine).mockReset();
	});

	it('patches lines for the BOM and skips frozen schedules', async () => {
		vi.mocked(listDeliverySchedules).mockResolvedValue([
			{ id: 'ds-1', status: 'Confirmed' },
			{ id: 'ds-2', status: 'Frozen' }
		] as never);
		vi.mocked(listDeliveryScheduleLinesByIds).mockResolvedValue([
			{
				delivery_schedule_line_id: 'line-1',
				delivery_schedule_id: 'ds-1',
				bom_id: 'bom-1',
				quantity: 4,
				unit: 'SET',
				description: '',
				cp_run_id: 'old-run'
			},
			{
				delivery_schedule_line_id: 'line-2',
				delivery_schedule_id: 'ds-1',
				bom_id: 'other-bom',
				quantity: 1,
				unit: 'SET',
				description: '',
				cp_run_id: null
			}
		] as never);
		vi.mocked(updateDeliveryScheduleLine).mockResolvedValue({} as never);

		const result = await repinDeliveryScheduleLinesForBom({
			projectId: 'proj-1',
			bomId: 'bom-1',
			runId: 'new-run'
		});

		expect(listDeliveryScheduleLinesByIds).toHaveBeenCalledWith(['ds-1'], undefined);
		expect(updateDeliveryScheduleLine).toHaveBeenCalledTimes(1);
		expect(updateDeliveryScheduleLine).toHaveBeenCalledWith(
			'line-1',
			{
				quantity: 4,
				unit: 'SET',
				description: '',
				cpRunId: 'new-run'
			},
			undefined
		);
		expect(result).toEqual({
			updated: 1,
			alreadyPinned: 0,
			skippedFrozenSchedules: 1,
			lineCount: 1
		});
	});

	it('counts already-pinned lines without patching', async () => {
		vi.mocked(listDeliverySchedules).mockResolvedValue([{ id: 'ds-1', status: 'Draft' }] as never);
		vi.mocked(listDeliveryScheduleLinesByIds).mockResolvedValue([
			{
				delivery_schedule_line_id: 'line-1',
				delivery_schedule_id: 'ds-1',
				bom_id: 'bom-1',
				quantity: 2,
				unit: 'SET',
				description: null,
				cp_run_id: 'same-run'
			}
		] as never);

		const result = await repinDeliveryScheduleLinesForBom({
			projectId: 'proj-1',
			bomId: 'bom-1',
			runId: 'same-run'
		});

		expect(updateDeliveryScheduleLine).not.toHaveBeenCalled();
		expect(result.alreadyPinned).toBe(1);
		expect(result.updated).toBe(0);
		expect(result.lineCount).toBe(1);
	});
});
