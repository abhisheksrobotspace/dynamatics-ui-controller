import type { TreeTableNode } from '@ifactory/ui-v2';
import type {
	ReviewInputPartRow,
	ReviewInputPlanDetail,
	ReviewInputSummary
} from './review-input.types.js';

export type { ReviewInputPartRow, ReviewInputPlanDetail, ReviewInputSummary };

const defaultNodes: TreeTableNode<ReviewInputPartRow>[] = [
	{
		id: 'j1055',
		label: 'J1055 Pune Transmission',
		children: [
			{
				id: 'ht-200',
				label: 'HT ANGLE 200×200×22',
				children: [
					{
						id: 'rm-a22-001',
						label: 'RM-A22-001',
						children: [
							{
								id: 'len-7-8',
								label: '7800',
								children: [
									{
										id: 'group-1',
										label: 'Group 1',
										children: [
											{
												id: 'part-71h',
												label: 'J55 DA 71H',
												data: {
													markLength: '2400',
													qty: '2',
													holes: '4',
													process: 'Drill+Cope',
													hasDxf: true
												}
											},
											{
												id: 'part-72h',
												label: 'J55 DA 72H',
												data: {
													markLength: '1800',
													qty: '1',
													holes: '2',
													process: 'Drill',
													hasDxf: true
												}
											},
											{
												id: 'part-73h',
												label: 'J55 DA 73H',
												data: {
													markLength: '3600',
													qty: '1',
													holes: '6',
													process: 'Cope',
													hasDxf: true
												}
											}
										]
									}
								]
							}
						]
					},
					{
						id: 'rm-a22-002',
						label: 'RM-A22-002',
						children: [
							{
								id: 'len-6-0',
								label: '6000',
								children: [
									{
										id: 'group-2',
										label: 'Group 1',
										children: [
											{
												id: 'part-81a',
												label: 'J55 DB 81A',
												data: {
													markLength: '2000',
													qty: '3',
													holes: '2',
													process: 'Drill',
													hasDxf: true
												}
											}
										]
									}
								]
							}
						]
					}
				]
			},
			{
				id: 'ms-150',
				label: 'MS PLATE 150×12',
				children: [
					{
						id: 'rm-p12-010',
						label: 'RM-P12-010',
						children: [
							{
								id: 'len-2-5',
								label: '2500',
								children: [
									{
										id: 'group-3',
										label: 'Group 1',
										children: [
											{
												id: 'part-plate-1',
												label: 'PL-01',
												data: {
													markLength: '2500',
													qty: '4',
													holes: '8',
													process: 'Punch',
													hasDxf: true
												}
											}
										]
									}
								]
							}
						]
					}
				]
			}
		]
	}
];

const detailsByPlanId: Record<string, ReviewInputPlanDetail> = {
	'mp-001': {
		summary: {
			releaseLabel: 'RELEASE G21/04/G20',
			createdAt: '2026-05-12',
			workOrderCount: 4,
			markCount: 127
		},
		nodes: defaultNodes
	},
	'mp-002': {
		summary: {
			releaseLabel: 'RELEASE G18/02/G11',
			createdAt: '2026-05-18',
			workOrderCount: 1,
			markCount: 42
		},
		nodes: defaultNodes
	},
	'mp-003': {
		summary: {
			releaseLabel: 'RELEASE G30/01/G08',
			createdAt: '2026-06-02',
			workOrderCount: 3,
			markCount: 98
		},
		nodes: defaultNodes
	},
	'mp-004': {
		summary: {
			releaseLabel: 'RELEASE G09/03/G04',
			createdAt: '2026-04-21',
			workOrderCount: 1,
			markCount: 18
		},
		nodes: defaultNodes
	},
	'mp-005': {
		summary: {
			releaseLabel: 'RELEASE G22/05/G19',
			createdAt: '2026-06-14',
			workOrderCount: 2,
			markCount: 64
		},
		nodes: defaultNodes
	}
};

/** @deprecated Prefer loadReviewInputDetail — kept for Production Schedule mock labels. */
export function getReviewInputDetail(planId: string): ReviewInputPlanDetail | undefined {
	return detailsByPlanId[planId];
}
