import { describe, expect, it } from 'vitest';
import { formatSectionWeightLabel } from './section-display';
import { parseBomCsvRows } from './bom-csv-parser';

const SAMPLE_ROWS = [
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
		'Mark No': 'JA40 HA 1163H',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 90X90X5',
		Width: null,
		Length: 7219,
		'Unit Wt kg/Mtr': 6.97,
		'Wt/Pc Black (Kgs)': 50.316,
		'No of Pcs': 2,
		'Weight in Kgs(black)': 100.632
	},
	{
		'Mark No': 'JA40 HA 1189H',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X4',
		Width: null,
		Length: 316,
		'Unit Wt kg/Mtr': 4.65,
		'Wt/Pc Black (Kgs)': 1.469,
		'No of Pcs': 2,
		'Weight in Kgs(black)': 2.938
	},
	{
		'Mark No': 'JA40 HA 1189PH',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X5',
		Width: null,
		Length: 317,
		'Unit Wt kg/Mtr': 5.77,
		'Wt/Pc Black (Kgs)': 1.829,
		'No of Pcs': 3,
		'Weight in Kgs(black)': 5.487
	},
	{
		'Mark No': 'JA40 HA 1194',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X6',
		Width: null,
		Length: 318,
		'Unit Wt kg/Mtr': 6.86,
		'Wt/Pc Black (Kgs)': 2.181,
		'No of Pcs': 4,
		'Weight in Kgs(black)': 8.724
	},
	{
		'Mark No': 'JA40 HA 1194A',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X7',
		Width: null,
		Length: 319,
		'Unit Wt kg/Mtr': 0.0,
		'Wt/Pc Black (Kgs)': 0.0,
		'No of Pcs': 5,
		'Weight in Kgs(black)': 0.0
	},
	{
		'Mark No': 'JA40 HA 1229H',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X8',
		Width: null,
		Length: 320,
		'Unit Wt kg/Mtr': 9.0,
		'Wt/Pc Black (Kgs)': 2.88,
		'No of Pcs': 6,
		'Weight in Kgs(black)': 17.28
	},
	{
		'Mark No': 'JA40 HA 1229PH',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X9',
		Width: null,
		Length: 321,
		'Unit Wt kg/Mtr': 0.0,
		'Wt/Pc Black (Kgs)': 0.0,
		'No of Pcs': 7,
		'Weight in Kgs(black)': 0.0
	},
	{
		'Mark No': 'JA40 HA 1222',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X10',
		Width: null,
		Length: 322,
		'Unit Wt kg/Mtr': 11.07,
		'Wt/Pc Black (Kgs)': 3.565,
		'No of Pcs': 8,
		'Weight in Kgs(black)': 28.52
	},
	{
		'Mark No': 'JA40 HA 1222XH',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X11',
		Width: null,
		Length: 323,
		'Unit Wt kg/Mtr': 0.0,
		'Wt/Pc Black (Kgs)': 0.0,
		'No of Pcs': 9,
		'Weight in Kgs(black)': 0.0
	},
	{
		'Mark No': 'JA40 HA 1296H',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X12',
		Width: null,
		Length: 324,
		'Unit Wt kg/Mtr': 0.0,
		'Wt/Pc Black (Kgs)': 0.0,
		'No of Pcs': 10,
		'Weight in Kgs(black)': 0.0
	},
	{
		'Mark No': 'JA40 HA 1296PH',
		'HT/MS/BN': 'HT',
		Section: 'HT ANGLE 75X75X13',
		Width: null,
		Length: 325,
		'Unit Wt kg/Mtr': 0.0,
		'Wt/Pc Black (Kgs)': 0.0,
		'No of Pcs': 11,
		'Weight in Kgs(black)': 0.0
	}
];

describe('JA40 BOM sample verification', () => {
	it('matches UI marks and rounded weights for all sections', () => {
		const { sections, error } = parseBomCsvRows(SAMPLE_ROWS);
		expect(error).toBeUndefined();
		expect(sections).toHaveLength(11);

		const expected: Record<string, { marks: number; weight: string }> = {
			'HT ANGLE 90x90x5': { marks: 2, weight: '218 kg' },
			'HT ANGLE 75x75x4': { marks: 1, weight: '3 kg' },
			'HT ANGLE 75x75x5': { marks: 1, weight: '5 kg' },
			'HT ANGLE 75x75x6': { marks: 1, weight: '9 kg' },
			'HT ANGLE 75x75x7': { marks: 1, weight: '-' },
			'HT ANGLE 75x75x8': { marks: 1, weight: '17 kg' },
			'HT ANGLE 75x75x9': { marks: 1, weight: '-' },
			'HT ANGLE 75x75x10': { marks: 1, weight: '29 kg' },
			'HT ANGLE 75x75x11': { marks: 1, weight: '-' },
			'HT ANGLE 75x75x12': { marks: 1, weight: '-' },
			'HT ANGLE 75x75x13': { marks: 1, weight: '-' }
		};

		for (const section of sections) {
			const allMarkIds = section.marks.map((mark) => mark.id);
			const weightLabel = formatSectionWeightLabel(section, allMarkIds);
			const spec = expected[section.name];

			expect(spec, `unexpected section ${section.name}`).toBeDefined();
			expect(section.marks).toHaveLength(spec.marks);
			expect(weightLabel).toBe(spec.weight);
		}
	});

	it('matches Weight in Kgs(black) totals from CSV for sections with unit weight', () => {
		const csvTotals = new Map<string, number>();
		for (const row of SAMPLE_ROWS) {
			const weight = row['Weight in Kgs(black)'] as number;
			csvTotals.set(String(row.Section), (csvTotals.get(String(row.Section)) ?? 0) + weight);
		}

		const { sections } = parseBomCsvRows(SAMPLE_ROWS);
		const section9090 = sections.find((s) => s.name === 'HT ANGLE 90x90x5')!;
		const allMarkIds = section9090.marks.map((m) => m.id);
		const computed = formatSectionWeightLabel(section9090, allMarkIds);

		expect(csvTotals.get('HT ANGLE 90X90X5')).toBeCloseTo(218.16, 2);
		expect(computed).toBe('218 kg');
	});
});
