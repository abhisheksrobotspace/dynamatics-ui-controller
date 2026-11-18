export type MetricFieldTone = 'default' | 'primary' | 'muted' | 'success';
export type MetricFieldAlign = 'start' | 'end';
export type MetricFieldSize = 'xs' | 'sm' | 'md' | 'lg';
export type MetricRowVariant = 'default' | 'emphasis';

export type MetricField = {
	label: string;
	value: string;
	tone?: MetricFieldTone;
	align?: MetricFieldAlign;
	size?: MetricFieldSize;
};
