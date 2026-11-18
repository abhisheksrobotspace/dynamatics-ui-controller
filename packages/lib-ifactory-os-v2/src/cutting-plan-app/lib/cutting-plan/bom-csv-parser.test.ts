import { describe, expect, it } from 'vitest';
import { normalizeBomSectionName, parseBomCsvRows } from './bom-csv-parser';

describe('parseBomCsvRows', () => {
	it('parses angle sections from csv_extractor rows', () => {
		const result = parseBomCsvRows([
			{
				'Mark No': 'J55 DB 20H',
				'HT/MS': 'HT',
				Section: 'HT ANGLE 90X90X5',
				Length: 3050,
				'Unit Wt kg/Mtr': 6.97,
				'No of Pcs': 2
			},
			{
				'Mark No': 'J55 DB 21H',
				Section: 'HT ANGLE 90X90X5',
				Length: 4100,
				'No of Pcs': 1
			}
		]);

		expect(result.error).toBeUndefined();
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0].name).toBe('HT ANGLE 90x90x5');
		expect(result.sections[0].marks).toHaveLength(2);
		expect(result.sections[0].unitWeightKgPerM).toBe(6.97);
	});

	it('normalizes duplicated section tokens', () => {
		expect(normalizeBomSectionName('HT HT ANGLE 100X100X6')).toBe('HT ANGLE 100x100x6');
	});

	it('parses csv_extractor rows with HT/MS/BN and unit weight columns', () => {
		const result = parseBomCsvRows([
			{
				'Mark No': 'JA40 HA 1163AH',
				'HT/MS/BN': 'HT',
				Section: 'HT ANGLE 90X90X5',
				Width: null,
				Length: 8431,
				'Unit Wt kg/Mtr': 6.97,
				'Wt/Pc Black (Kgs)': 58.764,
				'No of Pcs': 2,
				'Weight in Kgs(black)': 117.528
			},
			{
				'Mark No': 'JA40 HA 1189H',
				'HT/MS/BN': 'HT',
				Section: 'HT ANGLE 75X75X4',
				Length: 316,
				'Unit Wt kg/Mtr': 4.65,
				'Wt/Pc Black (Kgs)': 1.469,
				'No of Pcs': 2
			},
			{
				'Mark No': 'JA40 HA 1194A',
				Section: 'HT ANGLE 75X75X7',
				Length: 319,
				'Unit Wt kg/Mtr': 0,
				'Wt/Pc Black (Kgs)': 0,
				'No of Pcs': 5
			}
		]);

		expect(result.error).toBeUndefined();
		expect(result.sections).toHaveLength(3);

		const angle9090 = result.sections.find((section) => section.name === 'HT ANGLE 90x90x5');
		expect(angle9090?.unitWeightKgPerM).toBe(6.97);
		expect(angle9090?.marks[0].length).toBe(8431);
		expect(angle9090?.marks[0].qty).toBe(2);

		const angle7575x4 = result.sections.find((section) => section.name === 'HT ANGLE 75x75x4');
		expect(angle7575x4?.unitWeightKgPerM).toBe(4.65);

		const angle7575x7 = result.sections.find((section) => section.name === 'HT ANGLE 75x75x7');
		expect(angle7575x7?.unitWeightKgPerM).toBeUndefined();
	});
});
