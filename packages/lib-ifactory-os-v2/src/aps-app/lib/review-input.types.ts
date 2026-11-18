import type { TreeTableNode } from '@ifactory/ui-v2';

export type ReviewInputPartRow = {
	markLength?: string;
	qty?: string;
	holes?: string;
	process?: string;
	hasDxf?: boolean;
};

export type ReviewInputSummary = {
	releaseLabel: string;
	createdAt: string;
	workOrderCount: number;
	markCount: number;
};

export type ReviewInputPlanDetail = {
	summary: ReviewInputSummary;
	nodes: TreeTableNode<ReviewInputPartRow>[];
};
