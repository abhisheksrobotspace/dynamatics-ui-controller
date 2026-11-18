import type { ChartConfiguration, ChartOptions } from 'chart.js';
import {
	DEFAULT_CHART_COLORS,
	type BarChartBaseProps,
	type ChartOrientation,
	type ChartSeries
} from './chart.types';

type BuildBarConfigArgs = BarChartBaseProps & {
	stacked: boolean;
};

function resolveColor(series: ChartSeries, index: number): string {
	return series.color ?? DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]!;
}

function baseOptions(args: {
	orientation: ChartOrientation;
	stacked: boolean;
	showLegend: boolean;
	showGrid: boolean;
	showAxes: boolean;
	showCategoryAxisTitle: boolean;
	categoryAxisTitle: string;
	showValueAxisTitle: boolean;
	valueAxisTitle: string;
}): ChartOptions<'bar'> {
	const {
		orientation,
		stacked,
		showLegend,
		showGrid,
		showAxes,
		showCategoryAxisTitle,
		categoryAxisTitle,
		showValueAxisTitle,
		valueAxisTitle
	} = args;
	const categoryAxis = orientation === 'horizontal' ? 'y' : 'x';
	const valueAxis = orientation === 'horizontal' ? 'x' : 'y';

	return {
		indexAxis: orientation === 'horizontal' ? 'y' : 'x',
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		plugins: {
			legend: {
				display: showLegend,
				position: 'top',
				align: 'end',
				labels: {
					boxWidth: 10,
					boxHeight: 10,
					padding: 16,
					color: '#666666',
					font: { family: 'Space Grotesk', size: 12, weight: 500 }
				}
			},
			tooltip: {
				callbacks: {
					label: (ctx) => {
						const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : '';
						return `${label}${ctx.parsed[valueAxis] ?? ctx.raw}`;
					}
				}
			}
		},
		scales: {
			[categoryAxis]: {
				stacked,
				display: showAxes,
				grid: { display: false },
				border: { display: showAxes },
				ticks: {
					color: '#18181b',
					font: { family: 'Space Grotesk', size: 14, weight: 700 }
				},
				title: { display: showCategoryAxisTitle, text: categoryAxisTitle }
			},
			[valueAxis]: {
				stacked,
				display: showAxes,
				beginAtZero: true,
				grid: {
					display: showGrid,
					color: '#e5e5e5'
				},
				border: { display: showAxes },
				ticks: {
					color: '#666666',
					font: { family: 'Space Grotesk', size: 12 }
				},
				title: { display: showValueAxisTitle, text: valueAxisTitle }
			}
		},
		elements: {
			bar: {
				borderRadius: 0,
				borderSkipped: false
			}
		}
	};
}

export function buildBarConfig(args: BuildBarConfigArgs): ChartConfiguration<'bar'> {
	const {
		labels,
		series,
		orientation = 'vertical',
		showLegend = true,
		showGrid = false,
		showAxes = true,
		barThickness,
		stacked,
		showCategoryAxisTitle = false,
		categoryAxisTitle = '',
		showValueAxisTitle = false,
		valueAxisTitle = ''
	} = args;

	return {
		type: 'bar',
		data: {
			labels,
			datasets: series.map((item, index) => ({
				label: item.label,
				data: item.data,
				backgroundColor: resolveColor(item, index),
				borderWidth: 0,
				borderSkipped: false,
				...(barThickness !== undefined ? { barThickness } : {})
			}))
		},
		options: baseOptions({
			orientation,
			stacked,
			showLegend,
			showGrid,
			showAxes,
			showCategoryAxisTitle,
			categoryAxisTitle,
			showValueAxisTitle,
			valueAxisTitle
		})
	};
}
