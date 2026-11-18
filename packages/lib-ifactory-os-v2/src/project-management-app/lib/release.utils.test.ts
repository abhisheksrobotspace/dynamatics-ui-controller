import { describe, expect, it } from 'vitest';
import { ddMmYyyyToIsoDate, isoDateToDdMmYyyy } from './projects/releases.api.js';
import type { ProjReleaseLineRow } from './projects/types.js';
import type { BomConfig, TowerType } from './store.svelte.js';
import {
	alreadyReleasedByBomId,
	buildAllStructureEntries,
	createLineItemsFromBoms,
	flattenTowerEntriesToLineWrites,
	groupLinesIntoTowerEntries
} from './release.utils.js';

describe('release date helpers', () => {
	it('formats and converts dates', () => {
		expect(isoDateToDdMmYyyy('2026-07-03')).toBe('03/07/2026');
		expect(ddMmYyyyToIsoDate('03/07/2026')).toBe('2026-07-03');
		expect(ddMmYyyyToIsoDate('bad')).toBeNull();
	});
});

describe('release.utils', () => {
	const towers: TowerType[] = [
		{
			id: 't1',
			projectId: 'p1',
			sNo: 1,
			towerTypeName: 'DA',
			extensionsConfigured: 'No extensions'
		}
	];
	const boms: BomConfig[] = [
		{
			id: 'b1',
			towerId: 't1',
			sNo: 1,
			bomName: 'Basic Body',
			bomLineageId: 'b1',
			version: 1,
			stage: 'proto',
			bomFile: null,
			drawingsFile: null,
			extractStatus: 'extracted',
			ocrStatus: 'verified',
			cpStatus: 'planned'
		},
		{
			id: 'b2',
			towerId: 't1',
			sNo: 2,
			bomName: 'Body Ext',
			bomLineageId: 'b2',
			version: 1,
			stage: 'proto',
			bomFile: null,
			drawingsFile: null,
			extractStatus: 'extracted',
			ocrStatus: 'verified',
			cpStatus: 'planned'
		}
	];

	it('builds line items from BOMs only (no placeholders)', () => {
		expect(createLineItemsFromBoms('t1', boms)).toHaveLength(2);
		expect(createLineItemsFromBoms('missing', boms)).toEqual([]);
		expect(createLineItemsFromBoms('t1', boms)[0]?.bomId).toBe('b1');
	});

	it('sums already released from other project release bundles', () => {
		const lines = (bomId: string, quantity: number): ProjReleaseLineRow => ({
			release_line_id: `${bomId}-${quantity}`,
			release_id: 'r',
			bom_id: bomId,
			quantity,
			unit: 'Set'
		});
		const totals = alreadyReleasedByBomId(
			[
				{ releaseId: 'rel-1', lines: [lines('b1', 5), lines('b2', 1)] },
				{ releaseId: 'rel-2', lines: [lines('b1', 3)] }
			],
			'rel-draft'
		);
		expect(totals.get('b1')).toBe(8);
		expect(totals.get('b2')).toBe(1);

		const excludeSelf = alreadyReleasedByBomId(
			[
				{ releaseId: 'rel-1', lines: [lines('b1', 5)] },
				{ releaseId: 'rel-2', lines: [lines('b1', 3)] }
			],
			'rel-2'
		);
		expect(excludeSelf.get('b1')).toBe(5);
	});

	it('groups flat lines into tower entries and flattens writes', () => {
		const entries = groupLinesIntoTowerEntries(
			'rel-1',
			[
				{
					release_line_id: 'rl1',
					release_id: 'rel-1',
					bom_id: 'b1',
					quantity: 7,
					unit: 'Set',
					description: 'Basic Body'
				}
			],
			boms,
			towers,
			new Map([['b1', 2]])
		);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe('tower');
		expect(entries[0]?.thisRelease).toBe(7);
		expect(entries[0]?.lineItems[0]?.alreadyReleased).toBe(2);
		expect(entries[0]?.lineItems).toHaveLength(2);

		const writes = flattenTowerEntriesToLineWrites(entries);
		expect(writes.map((w) => w.bomId).sort()).toEqual(['b1']);
		expect(writes.find((w) => w.bomId === 'b1')?.quantity).toBe(7);
	});

	it('builds one entry per configured structure and skips zero-qty writes', () => {
		const entries = buildAllStructureEntries('rel-1', [], boms, towers, new Map(), 'tower');
		expect(entries).toHaveLength(1);
		expect(entries[0]?.lineItems).toHaveLength(2);
		expect(entries[0]?.lineItems.every((item) => item.thisRelease === 0)).toBe(true);
		expect(flattenTowerEntriesToLineWrites(entries)).toEqual([]);
	});
});
