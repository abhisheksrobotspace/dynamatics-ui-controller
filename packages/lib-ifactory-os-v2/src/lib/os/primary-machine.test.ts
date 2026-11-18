import { describe, expect, it } from 'vitest';
import { extractPrimaryMachine } from './primary-machine.js';

describe('extractPrimaryMachine', () => {
	it('reads the machine keyed by its aid, with its name and asset code', () => {
		expect(
			extractPrimaryMachine({
				'aid-1': {
					aid: 'aid-1',
					assetClass: 'notching',
					assetCode: 'RS/MNL',
					name: 'Test Machine - manual'
				},
				_shared: { autoAlertSelectTimeoutMs: 300000 }
			})
		).toEqual({
			aid: 'aid-1',
			assetClass: 'notching',
			name: 'Test Machine - manual',
			assetCode: 'RS/MNL'
		});
	});

	it('leaves the name empty when settings carry none', () => {
		expect(extractPrimaryMachine({ aid: 'aid-1', assetClass: 'angle' })).toEqual({
			aid: 'aid-1',
			assetClass: 'angle',
			name: null,
			assetCode: null
		});
	});
});
