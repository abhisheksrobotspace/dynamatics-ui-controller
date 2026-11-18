import { describe, expect, it } from 'vitest';
import { structureRefFromKind } from './assign-and-lock.replan';

describe('structureRefFromKind', () => {
	it('maps tower structures', () => {
		expect(structureRefFromKind('tower-1', 'tower')).toEqual({
			kind: 'tower',
			towerId: 'tower-1'
		});
	});

	it('maps stub structures', () => {
		expect(structureRefFromKind('stub-1', 'stub')).toEqual({
			kind: 'stub',
			stubId: 'stub-1'
		});
	});
});
