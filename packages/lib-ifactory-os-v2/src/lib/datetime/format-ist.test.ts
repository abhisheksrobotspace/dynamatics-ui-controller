import { describe, expect, it } from 'vitest';
import { formatUtcAsIst, parseUtcTimestamp } from './format-ist';

describe('parseUtcTimestamp', () => {
	it('parses Z-suffixed ISO as UTC', () => {
		expect(parseUtcTimestamp('2026-07-09T00:00:00Z').toISOString()).toBe(
			'2026-07-09T00:00:00.000Z'
		);
	});

	it('treats offset-less timestamps as UTC', () => {
		expect(parseUtcTimestamp('2026-07-09T00:00:00').toISOString()).toBe('2026-07-09T00:00:00.000Z');
		expect(parseUtcTimestamp('2026-07-09 00:00:00').toISOString()).toBe('2026-07-09T00:00:00.000Z');
	});

	it('parses Postgres timestamptz with hour-only offset', () => {
		expect(parseUtcTimestamp('2026-07-11 00:00:00+00').toISOString()).toBe(
			'2026-07-11T00:00:00.000Z'
		);
		expect(parseUtcTimestamp('2026-07-10 04:30:00+00').toISOString()).toBe(
			'2026-07-10T04:30:00.000Z'
		);
	});

	it('parses ISO offsets with colon', () => {
		expect(parseUtcTimestamp('2026-07-10T12:00:00+00:00').toISOString()).toBe(
			'2026-07-10T12:00:00.000Z'
		);
	});
});

describe('formatUtcAsIst', () => {
	it('converts midnight UTC to 5:30 AM IST', () => {
		const label = formatUtcAsIst('2026-07-09T00:00:00Z');
		expect(label).toMatch(/9 Jul 2026/);
		expect(label).toMatch(/5:30/);
	});

	it('formats Postgres +00 strings as IST (not raw)', () => {
		const label = formatUtcAsIst('2026-07-11 00:00:00+00');
		expect(label).not.toContain('+00');
		expect(label).toMatch(/11 Jul 2026/);
		expect(label).toMatch(/5:30/);
	});

	it('returns the original string when invalid', () => {
		expect(formatUtcAsIst('not-a-date')).toBe('not-a-date');
	});
});
