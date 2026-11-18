import { describe, expect, it } from 'vitest';
import type { Content, ContentSection, ContentTable, TableCell } from 'pdfmake/interfaces';
import {
	buildJobCardDocDefinition,
	jobCardPdfFileName,
	sumMarkTotals,
	sumRequisitionTotals,
	TITLE_CUTTING_PLAN,
	TITLE_JOB_CARD,
	TITLE_MACHINE_SCHEDULE,
	TITLE_SHOP_SKETCH,
	TITLE_STEEL_REQUISITION
} from './job-cards.pdf.js';
import type {
	JobCardCuttingBarRow,
	JobCardDetail,
	JobCardLoadingRow,
	JobCardMarkRow,
	JobCardRequisitionRow
} from './job-cards.types.js';

function markRow(overrides: Partial<JobCardMarkRow> = {}): JobCardMarkRow {
	return {
		id: 'm1',
		towerType: 'TestKDA',
		subtype: '-1.5MBE',
		markNo: 'J57 DA 2554H',
		lengthMm: 2716,
		widthMm: null,
		wtPerPieceKg: 12.63,
		totalPcs: 20,
		totalWtKg: 252.6,
		notchingWtKg: 252.6,
		bendingWtKg: 252.6,
		heelGrindingWtKg: 0,
		holes: 0,
		stepCodes: ['CPS', 'N'],
		operation: 'N',
		numBundles: 1,
		bundlesLabel: '20',
		sortOrder: 1,
		...overrides
	};
}

function loadingRow(overrides: Partial<JobCardLoadingRow> = {}): JobCardLoadingRow {
	return {
		id: 'l1',
		machineId: 'm-02',
		machineName: 'NJM-02',
		plannedStart: '24 Aug 2026, 2:26 pm',
		plannedEnd: '24 Aug 2026, 5:06 pm',
		materialId: 'HT ANGLE 75x75x4-10400-1',
		lengthMm: 10400,
		operation: 'CPS',
		qty: 10,
		...overrides
	};
}

function requisitionRow(overrides: Partial<JobCardRequisitionRow> = {}): JobCardRequisitionRow {
	return {
		id: 'r1',
		section: 'HT ANGLE 75x75x4',
		lengthMm: 10975,
		quantity: 10,
		weightKg: 51.03,
		...overrides
	};
}

function cuttingRow(overrides: Partial<JobCardCuttingBarRow> = {}): JobCardCuttingBarRow {
	return {
		id: 'c1',
		rmid: 'HT ANGLE 75x75x4-10975-1',
		lengthMm: 10975,
		quantity: 10,
		markings: 'J57 DA 2554H x2',
		markingItems: [{ mark: 'J57 DA 2554H', lengthMm: 2716, quantity: 2 }],
		usedMm: 10864,
		wasteMm: 111,
		wastePct: 1.01,
		wasteKg: 0.5,
		weightKg: 51.0,
		...overrides
	};
}

function detail(overrides: Partial<JobCardDetail> = {}): JobCardDetail {
	return {
		jobId: 'job-1',
		runId: 'run-1',
		planId: 'plan-1',
		jcSrNo: 'M-202',
		workOrder: 'WOK',
		towerType: 'TestKDA',
		subtype: '-1.5MBE',
		section: 'HT ANGLE 75x75x4',
		sets: 10,
		status: 'published',
		date: '01/09/2026',
		projectName: 'Test Project',
		customerName: 'Reliance',
		rmGrade: 'IS:2062-2011 GRADE E350A',
		batchNo: '-',
		plantId: 'plant-1',
		cardFy: null,
		solverJobId: 'solver-1',
		piecesTotal: 80,
		numBundles: 4,
		rows: [markRow()],
		loadingRows: [],
		requisitionRows: [],
		cuttingRows: [],
		cuttingSummary: null,
		drawings: [],
		...overrides
	};
}

function sections(doc: ReturnType<typeof buildJobCardDocDefinition>): ContentSection[] {
	return doc.content as ContentSection[];
}

function sectionTable(section: ContentSection): ContentTable {
	return section.section as ContentTable;
}

function sectionStack(section: ContentSection): Content[] {
	const root = section.section;
	if (typeof root === 'object' && root !== null && 'stack' in root) {
		return (root as { stack: Content[] }).stack;
	}
	const cell = sectionTable(section).table.body[0][0] as { stack: Content[] };
	return cell.stack;
}

function mastheadOf(section: ContentSection): ContentTable {
	return sectionStack(section)[0] as ContentTable;
}

function bodyOf(section: ContentSection): Content[] {
	const cell = sectionTable(section).table.body[1][0] as { stack: Content[] };
	return cell.stack;
}

function markTable(doc: ReturnType<typeof buildJobCardDocDefinition>): ContentTable {
	return bodyOf(sections(doc)[0])[0] as ContentTable;
}

function renderSectionFooter(
	section: ContentSection,
	currentPage: number,
	pageCount: number
): Content {
	const footer = section.footer;
	if (typeof footer !== 'function') throw new Error('expected a section footer');
	return footer(currentPage, pageCount, {
		width: 841.89,
		height: 595.28,
		orientation: 'landscape'
	}) as Content;
}

function occupySheetPages(section: ContentSection, pages: number[]): void {
	const background = section.background;
	if (typeof background !== 'function') throw new Error('expected a section background');
	const pageSize = { width: 841.89, height: 595.28, orientation: 'landscape' as const };
	for (const page of pages) {
		background(page, pageSize);
	}
}

function cellText(cell: TableCell): string {
	if (typeof cell === 'string') return cell;
	if (typeof cell === 'object' && cell !== null && 'text' in cell) return String(cell.text ?? '');
	return '';
}

describe('sumMarkTotals', () => {
	it('sums pieces, weights and bundles across rows', () => {
		const totals = sumMarkTotals([
			markRow({ totalPcs: 20, totalWtKg: 252.6, numBundles: 1 }),
			markRow({ totalPcs: 20, totalWtKg: 239.2, numBundles: 1, heelGrindingWtKg: 12 })
		]);
		expect(totals.pcs).toBe(40);
		expect(totals.bundles).toBe(2);
		expect(totals.heelGrindingKg).toBe(12);
		expect(totals.totalWtKg).toBeCloseTo(491.8, 6);
		expect(totals.notchingKg).toBeCloseTo(505.2, 6);
		expect(totals.bendingKg).toBeCloseTo(505.2, 6);
	});

	it('treats absent optional weights and bundles as zero', () => {
		const totals = sumMarkTotals([
			markRow({ notchingWtKg: null, bendingWtKg: null, heelGrindingWtKg: null, numBundles: null })
		]);
		expect(totals.notchingKg).toBe(0);
		expect(totals.bendingKg).toBe(0);
		expect(totals.heelGrindingKg).toBe(0);
		expect(totals.bundles).toBe(0);
	});
});

describe('buildJobCardDocDefinition', () => {
	it('renders an A4 landscape sheet', () => {
		const doc = buildJobCardDocDefinition(detail());
		expect(doc.pageSize).toBe('A4');
		expect(doc.pageOrientation).toBe('landscape');
	});

	it('emits the fifteen template columns with a repeating header row', () => {
		const table = markTable(buildJobCardDocDefinition(detail()));
		expect(table.table.widths).toHaveLength(15);
		expect(table.table.headerRows).toBe(1);
		expect(table.table.body[0].map(cellText)).toEqual([
			'Sr',
			'Tower Type',
			'Subtype',
			'Mark No',
			'Length\n(MM)',
			'Width\n(MM)',
			'WT / Piece\nIn kgs',
			'Total No\nof Pcs',
			'Total Wt\nin MT',
			'Notching\nWt MT',
			'Bending\nWt in MT',
			'H Grinding\nin MT',
			'Case No',
			'No of\nBundles',
			'Pcs Per\nBundle'
		]);
	});

	it('fits the columns inside the printable width once padding and rules are added', () => {
		const table = markTable(buildJobCardDocDefinition(detail()));
		const widths = table.table.widths as number[];
		// A4 landscape (841.89pt) less two 8mm margins.
		const printable = 841.89 - 2 * (8 / 0.264583) * 0.75;
		// pdfmake adds 2px cell padding per side and a 1px rule between every column on top
		// of these content widths; the drawn table must still land inside the margins.
		const padX = 2 * 0.75;
		const rule = 0.75;
		const chrome = widths.length * 2 * padX + (widths.length + 1) * rule;
		const drawn = widths.reduce((sum, w) => sum + w, 0) + chrome;
		expect(drawn).toBeCloseTo(printable, 1);
		expect(widths.every((w) => w > 0)).toBe(true);
	});

	it('prints tonnage columns in MT and per-piece weight in kg', () => {
		const table = markTable(buildJobCardDocDefinition(detail()));
		const row = table.table.body[1].map(cellText);
		expect(row[6]).toBe('12.630'); // WT / Piece in kgs
		expect(row[8]).toBe('0.253'); // 252.6 kg -> MT
		expect(row[11]).toBe('0.000'); // heel grinding
	});

	it('numbers rows and prints a dash when width is missing', () => {
		const doc = buildJobCardDocDefinition(
			detail({ rows: [markRow({ id: 'a' }), markRow({ id: 'b', widthMm: 65 })] })
		);
		const body = markTable(doc).table.body;
		expect(cellText(body[1][0])).toBe('1');
		expect(cellText(body[1][5])).toBe('-');
		expect(cellText(body[2][0])).toBe('2');
		expect(cellText(body[2][5])).toBe('65');
	});

	it('prints a dash for missing optional weights instead of inventing zero', () => {
		const row = markTable(
			buildJobCardDocDefinition(
				detail({
					rows: [
						markRow({
							notchingWtKg: null,
							bendingWtKg: null,
							heelGrindingWtKg: null,
							numBundles: null,
							bundlesLabel: ''
						})
					]
				})
			)
		).table.body[1].map(cellText);
		expect(row[9]).toBe('-');
		expect(row[10]).toBe('-');
		expect(row[11]).toBe('-');
		expect(row[12]).toBe('-');
		expect(row[13]).toBe('-');
		expect(row[14]).toBe('-');
	});

	it('closes the grid with a TOTAL row aligned to the template columns', () => {
		const doc = buildJobCardDocDefinition(
			detail({ rows: [markRow({ id: 'a' }), markRow({ id: 'b' })] })
		);
		const body = markTable(doc).table.body;
		const total = body[body.length - 1].map(cellText);
		expect(total[3]).toBe('TOTAL');
		expect(total[7]).toBe('40'); // pieces
		expect(total[8]).toBe('0.505'); // MT
		expect(total[13]).toBe('2'); // bundles
	});

	it('renders an empty grid as just the header and TOTAL rows', () => {
		const body = markTable(buildJobCardDocDefinition(detail({ rows: [] }))).table.body;
		expect(body).toHaveLength(2);
		expect(cellText(body[1][7])).toBe('0');
	});

	it('places the logo in the masthead only when one is supplied', () => {
		const logo = 'data:image/png;base64,AA';
		const withLogo = JSON.stringify(
			mastheadOf(sections(buildJobCardDocDefinition(detail(), { logoDataUrl: logo }))[0])
		);
		const withoutLogo = JSON.stringify(
			mastheadOf(sections(buildJobCardDocDefinition(detail()))[0])
		);
		expect(withLogo).toContain(logo);
		expect(withoutLogo).not.toContain('image');
	});

	it('centers the sheet title on the page with equal masthead flanks', () => {
		const masthead = mastheadOf(sections(buildJobCardDocDefinition(detail()))[0]);
		const widths = masthead.table.widths as number[];
		expect(widths).toHaveLength(3);
		expect(widths[0]).toBe(widths[2]);
		expect(cellText(masthead.table.body[0][1])).toBe(TITLE_JOB_CARD);
	});

	it('keeps signatures in the section footer so they cannot spill onto a following page', () => {
		const doc = buildJobCardDocDefinition(detail());
		const pages = sections(doc);
		const jobCardFooter = JSON.stringify(renderSectionFooter(pages[0], 1, 4));
		expect(jobCardFooter).toContain('Co-Ordinator');
		expect(jobCardFooter).toContain('HOD Planning');
		expect(jobCardFooter).toContain('Page 1 of 4');
		expect(JSON.stringify(renderSectionFooter(pages[1], 2, 4))).not.toContain('Co-Ordinator');
		expect(JSON.stringify(renderSectionFooter(pages[3], 4, 4))).toContain('Prepared By (Planning)');
		expect(JSON.stringify(bodyOf(pages[0]))).not.toContain('Co-Ordinator');
		expect(JSON.stringify(bodyOf(pages[3]))).not.toContain('Prepared By (Planning)');
	});

	it('prints the signature strip only on the last page of that section', () => {
		const pages = sections(buildJobCardDocDefinition(detail()));
		occupySheetPages(pages[0], [1, 2, 3]);
		expect(JSON.stringify(renderSectionFooter(pages[0], 1, 9))).not.toContain('Co-Ordinator');
		expect(JSON.stringify(renderSectionFooter(pages[0], 2, 9))).not.toContain('Co-Ordinator');
		expect(JSON.stringify(renderSectionFooter(pages[0], 1, 9))).toContain('Page 1 of 9');
		expect(JSON.stringify(renderSectionFooter(pages[0], 3, 9))).toContain('Co-Ordinator');
		expect(JSON.stringify(renderSectionFooter(pages[0], 3, 9))).toContain('Page 3 of 9');

		// Leftover TOTAL sheet: data rows fill page 7, TOTAL + masthead land on page 8.
		occupySheetPages(pages[0], [4, 5, 6, 7, 8]);
		expect(JSON.stringify(renderSectionFooter(pages[0], 7, 11))).not.toContain('Co-Ordinator');
		expect(JSON.stringify(renderSectionFooter(pages[0], 8, 11))).toContain('Co-Ordinator');

		occupySheetPages(pages[3], [8, 9]);
		expect(JSON.stringify(renderSectionFooter(pages[3], 8, 9))).not.toContain(
			'Prepared By (Planning)'
		);
		expect(JSON.stringify(renderSectionFooter(pages[3], 9, 9))).toContain('Prepared By (Planning)');
	});

	it('emits four sections through Cutting Plan, each with its own title', () => {
		const pages = sections(buildJobCardDocDefinition(detail()));
		expect(pages).toHaveLength(4);
		expect(cellText(mastheadOf(pages[0]).table.body[0][1])).toBe(TITLE_JOB_CARD);
		expect(cellText(mastheadOf(pages[1]).table.body[0][1])).toBe(TITLE_MACHINE_SCHEDULE);
		expect(cellText(mastheadOf(pages[2]).table.body[0][1])).toBe(TITLE_STEEL_REQUISITION);
		expect(cellText(mastheadOf(pages[3]).table.body[0][1])).toBe(TITLE_CUTTING_PLAN);
		expect(pages[0]).toHaveProperty('section');
		expect(pages[0]).not.toHaveProperty('pageBreak');
	});

	it('carries the job header fields from the detail record', () => {
		const rendered = JSON.stringify(mastheadOf(sections(buildJobCardDocDefinition(detail()))[0]));
		const strip = JSON.stringify(
			(
				sectionTable(sections(buildJobCardDocDefinition(detail()))[0]).table.body[0][0] as {
					stack: Content[];
				}
			).stack[1]
		);
		const header = rendered + strip;
		for (const value of [
			'M-202',
			'01/09/2026',
			'Reliance',
			'WOK',
			'HT ANGLE 75x75x4',
			'IS:2062-2011 GRADE E350A',
			'TestKDA',
			'-1.5MBE'
		]) {
			expect(header).toContain(value);
		}
	});
});

describe('later sheets', () => {
	it('prints machine schedule rows with the template columns', () => {
		const pages = sections(
			buildJobCardDocDefinition(
				detail({ loadingRows: [loadingRow(), loadingRow({ id: 'l2', qty: 20 })] })
			)
		);
		const table = bodyOf(pages[1])[1] as ContentTable;
		expect(table.table.body[0].map(cellText)).toEqual([
			'Sr',
			'Machine No. / Name',
			'Planned Start',
			'Planned End',
			'RM ID / Bundle ID',
			'Length\n(mm)',
			'Operation',
			'Bars'
		]);
		expect(cellText(table.table.body[1][1])).toBe('NJM-02');
		expect(cellText(table.table.body[2][7])).toBe('20');
		expect(JSON.stringify(renderSectionFooter(pages[1], 2, 4))).toContain('Planning');
	});

	it('prints steel requisition rows and a TOTAL in kg', () => {
		const pages = sections(
			buildJobCardDocDefinition(
				detail({
					requisitionRows: [
						requisitionRow(),
						requisitionRow({ id: 'r2', lengthMm: 10400, weightKg: 48.36 })
					]
				})
			)
		);
		const table = bodyOf(pages[2])[1] as ContentTable;
		const total = table.table.body[table.table.body.length - 1].map(cellText);
		expect(total[1]).toBe('TOTAL');
		expect(total[3]).toBe('20');
		expect(total[4]).toBe('99.39');
	});

	it('groups cutting-plan marks under each RM bar', () => {
		const pages = sections(buildJobCardDocDefinition(detail({ cuttingRows: [cuttingRow()] })));
		const plan = bodyOf(pages[3])[1] as { stack: Content[] };
		const group = plan.stack[0] as { stack: Content[] };
		const barHead = group.stack[0] as ContentTable;
		const cuts = group.stack[1] as ContentTable;
		expect(JSON.stringify(barHead)).toContain('HT ANGLE 75x75x4-10975-1');
		expect(JSON.stringify(barHead)).toContain('1 mark number');
		expect(JSON.stringify(barHead)).toContain('10975 mm');
		expect(JSON.stringify(barHead)).toContain('10 bars');
		expect(cuts.table.body[0].map(cellText)).toEqual([
			'Mark Number',
			'Mark Length (mm)',
			'Pcs / Bar',
			'Remarks'
		]);
		expect(cellText(cuts.table.body[1][0])).toBe('J57 DA 2554H');
		expect(cellText(cuts.table.body[1][1])).toBe('2716');
		expect(cellText(cuts.table.body[1][2])).toBe('2');
		expect(cellText(cuts.table.body[1][3])).toBe('-');
		expect(JSON.stringify(pages[3])).not.toContain('Waste');
		expect(JSON.stringify(renderSectionFooter(pages[3], 4, 4))).toContain('Prepared By (Planning)');
	});

	it('omits bundle-size from the cutting-plan job strip', () => {
		const pages = sections(buildJobCardDocDefinition(detail()));
		expect(JSON.stringify(sectionStack(pages[3])[1])).not.toContain('Bundle Size to Transfer Galv');
		expect(JSON.stringify(sectionStack(pages[0])[1])).toContain('Bundle Size to Transfer Galv');
	});
});

describe('shop sketches', () => {
	const PIXEL =
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

	it('omits sketch sheets when the card has no drawings', () => {
		expect(sections(buildJobCardDocDefinition(detail()))).toHaveLength(4);
	});

	it('appends one sheet per drawing after Cutting Plan', () => {
		const pages = sections(
			buildJobCardDocDefinition(
				detail({
					drawings: [
						{ id: 'm1', markNo: 'J57 DA 2554H', imageUrl: '/files/a' },
						{ id: 'm2', markNo: 'J57 DA 2555H', imageUrl: '/files/b' }
					]
				}),
				{ drawingDataUrls: { m1: PIXEL, m2: PIXEL } }
			)
		);
		expect(pages).toHaveLength(6);
		expect(cellText(mastheadOf(pages[4]).table.body[0][1])).toBe(TITLE_SHOP_SKETCH);
		expect(cellText(mastheadOf(pages[5]).table.body[0][1])).toBe(TITLE_SHOP_SKETCH);
		const first = JSON.stringify(pages[4]);
		expect(first).toContain('J57 DA 2554H');
		expect(first).toContain('2716 mm');
		expect(first).not.toContain('0 mm');
		expect(first).toContain('12.630 kg');
		expect(first).toContain(PIXEL);
		expect(JSON.stringify(renderSectionFooter(pages[4], 5, 6))).toContain('Page 5 of 6');
		expect(JSON.stringify(renderSectionFooter(pages[4], 5, 6))).not.toContain('Co-Ordinator');
		expect(pages[4].section).toMatchObject({ unbreakable: true });
	});

	it('prints a placeholder when the drawing image is missing', () => {
		const pages = sections(
			buildJobCardDocDefinition(
				detail({ drawings: [{ id: 'm1', markNo: 'J57 DA 2554H', imageUrl: '/files/a' }] })
			)
		);
		expect(pages).toHaveLength(5);
		expect(JSON.stringify(pages[4])).toContain('Shop drawing not available');
		expect(JSON.stringify(pages[4])).not.toContain('"image"');
	});
});

describe('sumRequisitionTotals', () => {
	it('sums quantity and weight', () => {
		const totals = sumRequisitionTotals([
			requisitionRow(),
			requisitionRow({ quantity: 10, weightKg: 48.36 })
		]);
		expect(totals.quantity).toBe(20);
		expect(totals.weightKg).toBeCloseTo(99.39, 6);
	});
});

describe('jobCardPdfFileName', () => {
	it('uses the JC/SR number', () => {
		expect(jobCardPdfFileName({ jcSrNo: 'M-202', jobId: 'job-1' })).toBe('job-card-M-202');
	});

	it('falls back to the job id and strips unsafe characters', () => {
		expect(jobCardPdfFileName({ jcSrNo: '', jobId: 'job/1 x' })).toBe('job-card-job-1-x');
	});
});
