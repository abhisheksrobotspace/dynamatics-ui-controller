import { describe, expect, it } from 'vitest';
import { filterSearchItems, splitHighlight } from './hmi.utils';

describe('splitHighlight', () => {
	it('returns the text untouched for an empty query', () => {
		expect(splitHighlight('M-121', '  ')).toEqual([{ text: 'M-121', match: false }]);
	});

	it('marks every case-insensitive occurrence', () => {
		expect(splitHighlight('M-212 · ab12', '12')).toEqual([
			{ text: 'M-2', match: false },
			{ text: '12', match: true },
			{ text: ' · ab', match: false },
			{ text: '12', match: true }
		]);
		expect(splitHighlight('isa 75', 'ISA')).toEqual([
			{ text: 'isa', match: true },
			{ text: ' 75', match: false }
		]);
	});
});

describe('filterSearchItems', () => {
	const items = [
		{ value: 'a', label: 'M-121 · ISA 75x75x6', meta: '29 Aug' },
		{ value: 'b', label: 'M-305 · ISA 90x90x8', meta: '12 Sep' },
		{ value: 'c', label: 'M-400', meta: '01 Oct' }
	];

	it('matches label or meta', () => {
		expect(filterSearchItems(items, '12').map((item) => item.value)).toEqual(['a', 'b']);
		expect(filterSearchItems(items, '').length).toBe(3);
	});
});
