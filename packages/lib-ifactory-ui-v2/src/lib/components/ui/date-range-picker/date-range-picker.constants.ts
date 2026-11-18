export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
] as const;

export const DEFAULT_SHIFTS = [
	{ name: 'Shift 1', start: '07:00', end: '19:00' },
	{ name: 'Shift 2', start: '19:00', end: '07:00' }
] as const;
