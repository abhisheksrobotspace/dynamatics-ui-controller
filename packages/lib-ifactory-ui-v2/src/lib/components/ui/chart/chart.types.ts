export type ChartOrientation = 'vertical' | 'horizontal';

export type ChartSeries = {
	label: string;
	data: number[];
	/** CSS color. Falls back to the default palette by series index. */
	color?: string;
};

export type BarChartBaseProps = {
	labels: string[];
	series: ChartSeries[];
	orientation?: ChartOrientation;
	showLegend?: boolean;
	showGrid?: boolean;
	showAxes?: boolean;
	barThickness?: number;
	class?: string;
	showCategoryAxisTitle?: boolean;
	categoryAxisTitle?: string;
	showValueAxisTitle?: boolean;
	valueAxisTitle?: string;
};

/** Default series colors — primary, online, loading, error, offline. */
export const DEFAULT_CHART_COLORS = [
	'#ff6c2e',
	'#22c55e',
	'#3b82f6',
	'#ef4444',
	'#9ca3af'
] as const;
