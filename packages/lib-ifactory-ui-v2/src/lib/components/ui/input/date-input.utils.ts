import { padTwo } from '../date-range-picker/date-range-picker.utils';

export function formatDdMmYyyy(date: Date): string {
	return `${padTwo(date.getDate())}/${padTwo(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function parseDdMmYyyy(value: string): Date | null {
	const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!match) return null;

	const day = Number.parseInt(match[1], 10);
	const month = Number.parseInt(match[2], 10) - 1;
	const year = Number.parseInt(match[3], 10);
	const date = new Date(year, month, day);

	if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
		return null;
	}

	return date;
}

export function isValidDdMmYyyy(value: string): boolean {
	return parseDdMmYyyy(value) !== null;
}
