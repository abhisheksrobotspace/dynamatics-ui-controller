import { DEFAULT_CHART_COLORS, type ChartConfiguration } from '@ifactory/ui-v2';

export function lineChartConfig(
	labels: string[],
	values: number[],
	label: string
): ChartConfiguration {
	return {
		type: 'line',
		data: {
			labels,
			datasets: [
				{
					label,
					data: values,
					borderColor: DEFAULT_CHART_COLORS[0],
					backgroundColor: 'rgba(255, 108, 46, 0.15)',
					fill: true,
					tension: 0.25,
					pointRadius: 2
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: {
				x: { ticks: { maxRotation: 45, minRotation: 0 } },
				y: { beginAtZero: true }
			}
		}
	};
}

export function doughnutChartConfig(labels: string[], values: number[]): ChartConfiguration {
	return {
		type: 'doughnut',
		data: {
			labels,
			datasets: [
				{
					data: values,
					backgroundColor: [...DEFAULT_CHART_COLORS]
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { position: 'right' } }
		}
	};
}
