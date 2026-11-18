import type {
	Content,
	ContentSection,
	TDocumentDefinitions,
	TableCell,
	TableLayout
} from 'pdfmake/interfaces';
import type {
	JobCardCuttingBarRow,
	JobCardDetail,
	JobCardDrawingRow,
	JobCardLoadingRow,
	JobCardMarkRow,
	JobCardRequisitionRow
} from './job-cards.types.js';
import { formatSheetKg, formatSheetMt } from './job-cards.weight.js';

/**
 * Printed job card through Cutting Plan.
 *
 * This module is deliberately pure - it only produces a pdfmake document definition and never
 * imports pdfmake itself, so it stays unit-testable and keeps the ~2 MB renderer out of any
 * bundle that does not download a job card. `job-cards.pdf.runtime.ts` owns the renderer.
 *
 * The layout mirrors the approved HTML template, which is authored in CSS pixels against a
 * 297 mm-wide sheet. At that width 1 px is exactly 0.75 pt, so every dimension below is the
 * template's px value passed through `pt()`. Keeping the raw px figures visible makes the two
 * documents diffable when the form is revised.
 *
 * Each section is a pdfmake `section` whose outer table uses `headerRows: 1` so the masthead
 * + job strip repeat if a grid overflows. Signatures live in that section's `footer`, which
 * pdfmake paints into the bottom margin after layout - they sit at the sheet foot without
 * occupying content height, so they cannot be pushed onto a following blank page. The footer
 * still runs on every page; the sign row is emitted only on the last page of that section.
 * That last page is tracked from the section `background` hook, which pdfmake fires on every
 * `pageAdded` - including a leftover TOTAL sheet that never shows up in the outer table's
 * `positions`. Continuation pages keep the page line.
 *
 * Shop sketches follow Cutting Plan, one sheet per marking. They reuse the masthead + job
 * strip, add a mark line, and fill the rest of the page with the drawing. No sign row.
 */

/** CSS px on the 297 mm template -> PDF points. */
function pt(px: number): number {
	return px * 0.75;
}

const PAGE_MARGIN = pt(8 / 0.264583); // 8 mm sheet padding
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const CONTENT_WIDTH = A4_LANDSCAPE_WIDTH - PAGE_MARGIN * 2;

const RULE = pt(1);
const INK = '#000000';
const GREY = '#ededed';
const BAR_HEAD = '#fafafa';
const QTY = '#c2410c';
const MUTED = '#333333';

/** Manrope is the app's heading face; it stands in for the template's Arial. */
export const FONT_HEADING = 'Manrope';
/** Space Grotesk is the app's body face; it stands in for the template's Times New Roman. */
export const FONT_BODY = 'SpaceGrotesk';

export const TITLE_JOB_CARD = 'JOB CARD';
export const TITLE_MACHINE_SCHEDULE = 'MACHINE SCHEDULE';
export const TITLE_STEEL_REQUISITION = 'STEEL REQUISITION';
export const TITLE_CUTTING_PLAN = 'CUTTING PLAN';
export const TITLE_SHOP_SKETCH = 'SHOP SKETCH';

const COMPANY_NAME = 'Jyoti Structures Ltd';
const COMPANY_ADDRESS = '52-53A, D Road, MIDC Area, Satpur, Nashik 422007';
const PREPARED_BY = 'Prepared with iFactoryOS';
const CUT_NOTE = 'Note :-  Check Shop drawing - Length and Section before cutting Mark No';
const MACHINE_LEDE = 'Sequence to be followed once raw material is received against this job card.';
const REQUISITION_LEDE = 'Raw material to be issued from Steel Stores against this job card.';
const CUTTING_LEDE = 'Raw material bars and the mark nos to be cut from each bar.';
const OPERATION_LEGEND =
	'Operation codes:  CPS = Cutting (Plan Set)    N = Notching    B = Bending    HG = Heel Grinding    D = Drilling    P = Punching    S = Stamping';

/** Template colgroup percentages for the mark grid; they sum to ~98.7 and are normalised. */
const MARK_COL_PCT = [2.3, 7.2, 6.5, 12, 6.2, 5.5, 7.2, 6.2, 6.5, 6.7, 7, 7.2, 5.5, 6.5, 6.2];
const MARK_PAD_X = pt(2);

const LOADING_COL_PCT = [3, 14, 15, 15, 26, 7, 12, 8];
const REQUISITION_COL_PCT = [3, 25, 11, 11, 11, 14, 10, 15];
/** Template `.cuts` colgroup: Mark Number / Mark Length / Pcs per Bar / Remarks. */
const CUTTING_COL_PCT = [41, 24, 16, 19];

/** Template flex-basis percentages for the eleven job header fields. */
const JOB_FIELD_PCT = [
	7.752, 7.752, 8.527, 6.202, 6.202, 13.178, 16.279, 7.752, 7.752, 6.202, 12.403
];
/** Cutting Plan drops "Bundle Size to Transfer Galv" and redistributes the strip. */
const CUTTING_JOB_FIELD_PCT = [8.85, 8.85, 9.735, 7.08, 7.08, 15.044, 18.584, 8.85, 8.85, 7.08];
const JOB_FIELD_PAD_X = pt(6);

/** Template `.markline` flex-basis percentages; they sum to 100. */
const MARKLINE_PCT = [16.667, 10.417, 10.417, 10.417, 10.417, 10.417, 10.417, 10.417, 10.417];

/** Template `.sig` / `.jc-sign` row is 26px; page line sits under it. */
const SIGN_ROW_HEIGHT = pt(26);
const CUT_NOTE_HEIGHT = pt(9) * 1.2 + pt(3);
const PAGE_NUMBER_BAND = pt(22);
/** Reserved for the sign row + cutting note so page numbers stay pinned when signs are omitted. */
const SIGNATURE_BAND = SIGN_ROW_HEIGHT + CUT_NOTE_HEIGHT;
/** Tallest footer (job-card sign row + cutting note + page line). */
const FOOTER_BAND = SIGNATURE_BAND + PAGE_NUMBER_BAND;
/**
 * Space left for the drawing after the sketch chrome. Masthead / job / mark strips measure
 * taller than the template CSS once pdfmake padding and rules are included, so the chrome
 * budget is deliberately loose - an oversized fit height is what split header and drawing
 * onto two pages.
 */
const SKETCH_CONTENT_HEIGHT = A4_LANDSCAPE_HEIGHT - PAGE_MARGIN - PAGE_NUMBER_BAND;
const SKETCH_CHROME = pt(55) + pt(44) + pt(44); // masthead + jobline + markline
const SKETCH_IMAGE_GAP = pt(5);
const SKETCH_IMAGE_HEIGHT = SKETCH_CONTENT_HEIGHT - SKETCH_CHROME - SKETCH_IMAGE_GAP;

/** Signature strip percentages. */
const SIGNATURE_PCT = [22, 25, 22, 31];
const SIGNATURE_PAD_X = pt(5);

const MARK_HEADERS = [
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
];

const LOADING_HEADERS = [
	'Sr',
	'Machine No. / Name',
	'Planned Start',
	'Planned End',
	'RM ID / Bundle ID',
	'Length\n(mm)',
	'Operation',
	'Bars'
];

const REQUISITION_HEADERS = [
	'Sr',
	'Section',
	'Length (mm)',
	'Quantity (nos)',
	'Weight (kg)',
	'Bundle / Bay No.',
	'Issued Qty',
	'Remarks'
];

const CUTTING_HEADERS = ['Mark Number', 'Mark Length (mm)', 'Pcs / Bar', 'Remarks'];

/**
 * Spread percentage columns across the printable width.
 *
 * pdfmake treats `widths` as the *content* box of each cell and then adds cell padding and the
 * vertical rules on top, so the chrome has to come out of the budget first or the table runs off
 * the right edge of the sheet.
 */
function tableWidths(pct: number[], padX: number): number[] {
	const columns = pct.length;
	const chrome = columns * 2 * padX + (columns + 1) * RULE;
	const available = CONTENT_WIDTH - chrome;
	const total = pct.reduce((sum, value) => sum + value, 0);
	return pct.map((value) => (value / total) * available);
}

function text(value: string | number | null | undefined, fallback = ''): string {
	if (value == null) return fallback;
	const trimmed = String(value).trim();
	return trimmed || fallback;
}

/** Missing / non-applicable width prints as a dash - never invent a zero. */
function widthCell(widthMm: number | null | undefined): string {
	return widthMm == null || !Number.isFinite(widthMm) || widthMm <= 0 ? '-' : String(widthMm);
}

function withUnit(value: string, unit: string): string {
	return value === '-' ? '-' : `${value} ${unit}`;
}

function numText(value: number | null | undefined): string {
	return value == null || !Number.isFinite(value) ? '-' : String(value);
}

export type JobCardMarkTotals = {
	pcs: number;
	totalWtKg: number;
	notchingKg: number;
	bendingKg: number;
	heelGrindingKg: number;
	bundles: number;
};

/** Column totals for the grey TOTAL row that closes the mark grid. */
export function sumMarkTotals(rows: JobCardMarkRow[]): JobCardMarkTotals {
	return rows.reduce<JobCardMarkTotals>(
		(totals, row) => ({
			pcs: totals.pcs + row.totalPcs,
			totalWtKg: totals.totalWtKg + row.totalWtKg,
			notchingKg: totals.notchingKg + (row.notchingWtKg ?? 0),
			bendingKg: totals.bendingKg + (row.bendingWtKg ?? 0),
			heelGrindingKg: totals.heelGrindingKg + (row.heelGrindingWtKg ?? 0),
			bundles: totals.bundles + (row.numBundles ?? 0)
		}),
		{ pcs: 0, totalWtKg: 0, notchingKg: 0, bendingKg: 0, heelGrindingKg: 0, bundles: 0 }
	);
}

export type RequisitionTotals = {
	quantity: number;
	weightKg: number;
};

export function sumRequisitionTotals(rows: JobCardRequisitionRow[]): RequisitionTotals {
	return rows.reduce<RequisitionTotals>(
		(totals, row) => ({
			quantity: totals.quantity + row.quantity,
			weightKg: totals.weightKg + row.weightKg
		}),
		{ quantity: 0, weightKg: 0 }
	);
}

/** Outer box only - used for the masthead, which has no internal dividers. */
function boxLayout(options: { bottom: boolean; padX: number; padY: number }): TableLayout {
	return {
		hLineWidth: (i, node) =>
			i === 0 || (options.bottom && i === node.table.body.length) ? RULE : 0,
		vLineWidth: (i, node) => (i === 0 || i === node.table.widths?.length ? RULE : 0),
		hLineColor: () => INK,
		vLineColor: () => INK,
		paddingLeft: () => options.padX,
		paddingRight: () => options.padX,
		paddingTop: () => options.padY,
		paddingBottom: () => options.padY
	};
}

/**
 * Full grid with internal dividers - the job header strip and the mark grid.
 *
 * Row height comes from padding rather than an explicit `heights` array: pdfmake clips content
 * that overflows a fixed row height, which silently swallowed long values such as the RM grade.
 */
function gridLayout(padding: { x: number; y: number; headerY?: number }): TableLayout {
	const padY = (rowIndex: number) =>
		rowIndex === 0 && padding.headerY != null ? padding.headerY : padding.y;
	return {
		hLineWidth: () => RULE,
		vLineWidth: () => RULE,
		hLineColor: () => INK,
		vLineColor: () => INK,
		paddingLeft: () => padding.x,
		paddingRight: () => padding.x,
		paddingTop: (i) => padY(i),
		paddingBottom: (i) => padY(i)
	};
}

/** One `.jf` cell: a small caption above a bold value. */
function jobField(label: string, value: string): TableCell {
	return {
		stack: [
			{ text: label, fontSize: pt(7.5), color: '#444444', lineHeight: 1.25 },
			{ text: value, fontSize: pt(11), bold: true, lineHeight: 1.25, noWrap: true }
		],
		font: FONT_HEADING
	};
}

/**
 * Left and right masthead flanks share this width so the title column is geometrically
 * centered on the sheet. A short title like "JOB CARD" would otherwise sit off to the right
 * of the (much wider) brand block.
 */
const MASTHEAD_SIDE = pt(49) + pt(250);

function buildMasthead(title: string, logoDataUrl?: string): Content {
	const brandColumns: ({ width: number | string } & Content)[] = [];
	if (logoDataUrl) {
		brandColumns.push({
			image: logoDataUrl,
			fit: [pt(40), pt(32)],
			width: pt(49)
		});
	}
	brandColumns.push({
		width: '*',
		stack: [
			{ text: COMPANY_NAME, bold: true, fontSize: pt(15), lineHeight: 1.25 },
			{ text: COMPANY_ADDRESS, fontSize: pt(8), color: MUTED, lineHeight: 1.25 }
		],
		font: FONT_HEADING
	});

	return {
		table: {
			widths: [MASTHEAD_SIDE, '*', MASTHEAD_SIDE],
			body: [
				[
					{ columns: brandColumns },
					{
						text: title,
						alignment: 'center',
						bold: true,
						fontSize: pt(19),
						font: FONT_HEADING,
						margin: [0, pt(6), 0, 0]
					},
					{
						text: PREPARED_BY,
						alignment: 'right',
						fontSize: pt(7),
						color: MUTED,
						lineHeight: 1.5,
						font: FONT_HEADING,
						margin: [0, pt(8), 0, 0]
					}
				]
			]
		},
		// No bottom rule - the job header strip below draws its own, so they share one line.
		layout: boxLayout({ bottom: false, padX: pt(7), padY: pt(5) })
	};
}

function buildJobStrip(detail: JobCardDetail, fieldPct: number[] = JOB_FIELD_PCT): Content {
	const fields: TableCell[] = [
		jobField('JC / SR. No.', text(detail.jcSrNo, '-')),
		jobField('Date', text(detail.date, '-')),
		jobField('Customer', text(detail.customerName, '-')),
		jobField('W.O. No.', text(detail.workOrder, '-')),
		jobField('Batch No', text(detail.batchNo, '-')),
		jobField('Section', text(detail.section, '-')),
		jobField('RM Grade', text(detail.rmGrade, '-')),
		jobField('Tower Type', text(detail.towerType, '-')),
		jobField('Subtype', text(detail.subtype, '-')),
		jobField('No of Sets', text(detail.sets, '-'))
	];
	if (fieldPct.length > 10) {
		fields.push(jobField('Bundle Size to Transfer Galv', ' '));
	}
	return {
		table: {
			widths: tableWidths(fieldPct, JOB_FIELD_PAD_X),
			body: [fields]
		},
		layout: gridLayout({ x: JOB_FIELD_PAD_X, y: pt(5.5) })
	};
}

function markLineField(label: string, value: string, mark = false): TableCell {
	return {
		stack: [
			{ text: label, fontSize: pt(7.5), color: '#444444', lineHeight: 1.25 },
			{
				text: value,
				fontSize: mark ? pt(12.5) : pt(11),
				bold: true,
				lineHeight: 1.25,
				noWrap: true
			}
		],
		font: FONT_HEADING,
		fillColor: GREY
	};
}

function markRowForDrawing(
	rows: JobCardMarkRow[],
	drawing: JobCardDrawingRow
): JobCardMarkRow | undefined {
	return (
		rows.find((row) => row.id === drawing.id) ?? rows.find((row) => row.markNo === drawing.markNo)
	);
}

/** Grey mark strip under the job header on each shop-sketch sheet. */
function buildMarkStrip(detail: JobCardDetail, drawing: JobCardDrawingRow): Content {
	const row = markRowForDrawing(detail.rows, drawing);
	return {
		table: {
			widths: tableWidths(MARKLINE_PCT, JOB_FIELD_PAD_X),
			body: [
				[
					markLineField('Mark No', text(drawing.markNo, '-'), true),
					markLineField('Length', row ? `${row.lengthMm} mm` : '-'),
					markLineField('Width', withUnit(widthCell(row?.widthMm), 'mm')),
					markLineField(
						'Wt / Piece',
						row ? withUnit(formatSheetKg(row.wtPerPieceKg, 3), 'kg') : '-'
					),
					markLineField('Total Pcs', row ? String(row.totalPcs) : '-'),
					markLineField('Total Wt', row ? withUnit(formatSheetMt(row.totalWtKg), 'MT') : '-'),
					markLineField('No of Bundles', row?.numBundles == null ? '-' : String(row.numBundles)),
					markLineField('Pcs Per Bundle', text(row?.bundlesLabel, '-')),
					markLineField('Case No', '-')
				]
			]
		},
		layout: gridLayout({ x: JOB_FIELD_PAD_X, y: pt(5.5) })
	};
}

function buildSketchImage(imageDataUrl: string | undefined): Content {
	if (!imageDataUrl) {
		return {
			text: 'Shop drawing not available',
			italics: true,
			fontSize: pt(12),
			color: '#888888',
			alignment: 'center',
			margin: [0, SKETCH_IMAGE_GAP + pt(40), 0, 0]
		};
	}
	return {
		image: imageDataUrl,
		fit: [CONTENT_WIDTH, SKETCH_IMAGE_HEIGHT],
		alignment: 'center',
		margin: [0, SKETCH_IMAGE_GAP, 0, 0]
	};
}

/** One shop-sketch sheet. Page numbers only - the template has no sign row here. */
function sketchPage(
	detail: JobCardDetail,
	logoDataUrl: string | undefined,
	drawing: JobCardDrawingRow,
	imageDataUrl: string | undefined
): ContentSection {
	return {
		section: {
			// Keep masthead + mark strip + drawing on one sheet. Without this, an oversized
			// image fit height pushed the drawing alone onto the next page.
			unbreakable: true,
			stack: [
				buildMasthead(TITLE_SHOP_SKETCH, logoDataUrl),
				buildJobStrip(detail),
				buildMarkStrip(detail, drawing),
				buildSketchImage(imageDataUrl)
			]
		},
		pageOrientation: 'landscape',
		pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_NUMBER_BAND],
		footer: (currentPage, pageCount) => buildPageNumberFooter(currentPage, pageCount)
	};
}

function headerRow(headers: string[], alignment: 'center' | 'left' = 'center'): TableCell[] {
	return headers.map((header) => ({ text: header, style: 'gridHead', alignment }));
}

/** Mark grid rows plus the closing TOTAL row. */
function buildMarkTable(rows: JobCardMarkRow[]): Content {
	const totals = sumMarkTotals(rows);

	const bodyRows: TableCell[][] = rows.map((row, index) => [
		{ text: String(index + 1) },
		{ text: text(row.towerType, '-') },
		{ text: text(row.subtype, '-') },
		{ text: text(row.markNo, '-'), bold: true },
		{ text: row.lengthMm == null || !Number.isFinite(row.lengthMm) ? '-' : String(row.lengthMm) },
		{ text: widthCell(row.widthMm) },
		{ text: formatSheetKg(row.wtPerPieceKg, 3) },
		{ text: row.totalPcs == null || !Number.isFinite(row.totalPcs) ? '-' : String(row.totalPcs) },
		{ text: formatSheetMt(row.totalWtKg) },
		{ text: formatSheetMt(row.notchingWtKg) },
		{ text: formatSheetMt(row.bendingWtKg) },
		{ text: formatSheetMt(row.heelGrindingWtKg) },
		{ text: '-' },
		{ text: row.numBundles == null ? '-' : String(row.numBundles) },
		{ text: text(row.bundlesLabel, '-') }
	]);

	const totalRow: TableCell[] = [
		{ text: '', style: 'gridTotal' },
		{ text: '', style: 'gridTotal' },
		{ text: '', style: 'gridTotal' },
		{ text: 'TOTAL', style: 'gridTotal' },
		{ text: '', style: 'gridTotal' },
		{ text: '', style: 'gridTotal' },
		{ text: '', style: 'gridTotal' },
		{ text: String(totals.pcs), style: 'gridTotal' },
		{ text: formatSheetMt(totals.totalWtKg), style: 'gridTotal' },
		{ text: formatSheetMt(totals.notchingKg), style: 'gridTotal' },
		{ text: formatSheetMt(totals.bendingKg), style: 'gridTotal' },
		{ text: formatSheetMt(totals.heelGrindingKg), style: 'gridTotal' },
		{ text: '', style: 'gridTotal' },
		{ text: totals.bundles ? String(totals.bundles) : '-', style: 'gridTotal' },
		{ text: '', style: 'gridTotal' }
	];

	return {
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: tableWidths(MARK_COL_PCT, MARK_PAD_X),
			body: [headerRow(MARK_HEADERS), ...bodyRows, totalRow]
		},
		layout: gridLayout({ x: MARK_PAD_X, y: pt(3.5), headerY: pt(4) }),
		style: 'gridCell'
	};
}

function buildLoadingTable(rows: JobCardLoadingRow[]): Content {
	const bodyRows: TableCell[][] = rows.map((row, index) => [
		{ text: String(index + 1) },
		{ text: text(text(row.machineId, '-')) },
		{ text: text(row.plannedStart, '-') },
		{ text: text(row.plannedEnd, '-') },
		{ text: text(row.materialId, '-'), alignment: 'left' },
		{ text: row.lengthMm == null || !Number.isFinite(row.lengthMm) ? '-' : String(row.lengthMm) },
		{ text: text(row.operation, '-') },
		{ text: row.qty == null || !Number.isFinite(row.qty) ? '-' : String(row.qty) }
	]);

	return {
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: tableWidths(LOADING_COL_PCT, MARK_PAD_X),
			body: [headerRow(LOADING_HEADERS), ...bodyRows]
		},
		layout: gridLayout({ x: MARK_PAD_X, y: pt(3.5), headerY: pt(4) }),
		style: 'gridCell'
	};
}

function buildRequisitionTable(rows: JobCardRequisitionRow[]): Content {
	const totals = sumRequisitionTotals(rows);
	const bodyRows: TableCell[][] = rows.map((row, index) => [
		{ text: String(index + 1) },
		{ text: text(row.section, '-'), alignment: 'left' },
		{ text: row.lengthMm == null || !Number.isFinite(row.lengthMm) ? '-' : String(row.lengthMm) },
		{ text: row.quantity == null || !Number.isFinite(row.quantity) ? '-' : String(row.quantity) },
		{ text: formatSheetKg(row.weightKg) },
		{ text: '' },
		{ text: '' },
		{ text: '' }
	]);

	const totalRow: TableCell[] = [
		{ text: '', style: 'gridTotal' },
		{ text: 'TOTAL', style: 'gridTotal', alignment: 'left' },
		{ text: '', style: 'gridTotal' },
		{ text: String(totals.quantity), style: 'gridTotal' },
		{ text: formatSheetKg(totals.weightKg), style: 'gridTotal' },
		{ text: '', style: 'gridTotal' },
		{ text: '', style: 'gridTotal' },
		{ text: '', style: 'gridTotal' }
	];

	return {
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: tableWidths(REQUISITION_COL_PCT, MARK_PAD_X),
			body: [headerRow(REQUISITION_HEADERS), ...bodyRows, totalRow]
		},
		layout: gridLayout({ x: MARK_PAD_X, y: pt(3.5), headerY: pt(4) }),
		style: 'gridCell'
	};
}

function barHeadMetric(label: string, value: string, color?: string): TableCell {
	return {
		stack: [
			{
				text: label,
				bold: true,
				fontSize: pt(6.5),
				color: '#666666',
				characterSpacing: 0.4,
				lineHeight: 1.3
			},
			{ text: value, fontSize: pt(10), bold: true, color: color ?? INK, lineHeight: 1.3 }
		],
		font: FONT_HEADING
	};
}

function markCountLabel(count: number): string {
	return count === 1 ? '1 mark number' : `${count} mark numbers`;
}

function quantityLabel(quantity: number | null | undefined): string {
	if (quantity == null || !Number.isFinite(quantity)) return '-';
	return quantity === 1 ? '1 bar' : `${quantity} bars`;
}

function buildBarGroup(row: JobCardCuttingBarRow): Content {
	const cutsBody: TableCell[][] = [headerRow(CUTTING_HEADERS, 'left')];
	const items =
		row.markingItems.length > 0 ? row.markingItems : [{ mark: '', lengthMm: NaN, quantity: NaN }];
	for (const item of items) {
		cutsBody.push([
			{ text: text(item.mark, '-'), alignment: 'left' },
			{ text: numText(item.lengthMm), alignment: 'left' },
			{ text: numText(item.quantity), alignment: 'left' },
			{ text: '-' }
		]);
	}

	return {
		unbreakable: true,
		margin: [0, 0, 0, pt(9)],
		stack: [
			{
				table: {
					widths: ['*', 'auto', '9%', '20%'],
					body: [
						[
							{
								stack: [
									{
										text: text(row.rmid, '-'),
										bold: true,
										fontSize: pt(11.5),
										lineHeight: 1.3
									},
									{
										text: markCountLabel(row.markingItems.length),
										fontSize: pt(7.5),
										color: '#666666',
										lineHeight: 1.3
									}
								],
								font: FONT_HEADING,
								fillColor: BAR_HEAD
							},
							{
								...barHeadMetric('RM LENGTH', withUnit(numText(row.lengthMm), 'mm')),
								fillColor: BAR_HEAD
							},
							{ text: '', fillColor: BAR_HEAD },
							{
								...barHeadMetric('QUANTITY', quantityLabel(row.quantity), QTY),
								fillColor: BAR_HEAD
							}
						]
					]
				},
				layout: boxLayout({ bottom: false, padX: pt(8), padY: pt(4) })
			},
			{
				table: {
					headerRows: 1,
					dontBreakRows: true,
					widths: tableWidths(CUTTING_COL_PCT, MARK_PAD_X),
					body: cutsBody
				},
				layout: gridLayout({ x: MARK_PAD_X, y: pt(3.5), headerY: pt(4) }),
				style: 'gridCell'
			}
		]
	};
}

/** One `.bargrp` per RM bar: identity strip + the marks to cut from that bar. */
function buildCuttingPlan(rows: JobCardCuttingBarRow[]): Content {
	if (rows.length === 0) {
		return { text: '' };
	}
	return { stack: rows.map(buildBarGroup) };
}

function buildSignRow(labels: string[]): Content {
	const padX = SIGNATURE_PAD_X;
	const even = labels.map(() => 1);
	return {
		table: {
			widths: tableWidths(even, padX),
			body: [labels.map((label) => ({ text: label }))]
		},
		layout: gridLayout({ x: padX, y: pt(6) }),
		style: 'signature'
	};
}

/** Job-card signature strip + cutting note - last page of the Job Card section only. */
function buildJobCardSignatures(): Content {
	return {
		stack: [
			{
				table: {
					widths: tableWidths(SIGNATURE_PCT, SIGNATURE_PAD_X),
					body: [
						[
							{ text: 'Co-Ordinator' },
							{ text: 'HOD Planning' },
							{ text: 'Date:' },
							{
								columns: [
									{ text: '(Material Issued By)', width: '*' },
									{ text: '(SR Entered By)', width: 'auto', alignment: 'right' }
								]
							}
						]
					]
				},
				layout: gridLayout({ x: SIGNATURE_PAD_X, y: pt(6) }),
				style: 'signature'
			},
			{
				text: CUT_NOTE,
				style: 'cutNote',
				margin: [0, pt(3), 0, 0]
			}
		]
	};
}

function lede(copy: string): Content {
	return {
		text: copy,
		font: FONT_HEADING,
		fontSize: pt(9),
		margin: [0, pt(6), 0, pt(6)]
	};
}

/** Highest page this section occupied, recorded as pdfmake creates pages. */
function lastOccupiedPage(pages: number[]): number | undefined {
	if (pages.length === 0) return undefined;
	return Math.max(...pages);
}

/** Holds the footer band height so the page line does not jump up on continuation pages. */
function signatureSpacer(): Content {
	return {
		table: {
			widths: ['*'],
			heights: [SIGNATURE_BAND],
			body: [[{ text: '' }]]
		},
		layout: 'noBorders'
	};
}

/**
 * One printed section. The outer table's header row is the masthead + job strip, so those
 * repeat when the inner grid overflows. The sign row is the section footer, painted into the
 * bottom margin after layout so it cannot force a new page. Continuation pages of the same
 * section keep the reserved band empty and only print the page line.
 *
 * `background` is not drawn; pdfmake still calls it from `pageAdded`, which is the only hook
 * that sees a leftover TOTAL page created by `headerRows` + `dontBreakRows`.
 */
function sectionPage(
	title: string,
	detail: JobCardDetail,
	logoDataUrl: string | undefined,
	body: Content[],
	signatures: Content,
	jobFieldPct: number[] = JOB_FIELD_PCT
): ContentSection {
	const occupiedPages: number[] = [];
	return {
		section: {
			table: {
				headerRows: 1,
				widths: ['*'],
				body: [
					[{ stack: [buildMasthead(title, logoDataUrl), buildJobStrip(detail, jobFieldPct)] }],
					[{ stack: body }]
				]
			},
			layout: 'noBorders'
		},
		pageOrientation: 'landscape',
		pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, FOOTER_BAND],
		background: (currentPage) => {
			occupiedPages.push(currentPage);
		},
		footer: (currentPage, pageCount) =>
			buildSectionFooter(occupiedPages, signatures, currentPage, pageCount)
	};
}

function buildPageNumberFooter(currentPage: number, pageCount: number): Content {
	return {
		margin: [PAGE_MARGIN, pt(4), PAGE_MARGIN, 0],
		text: `${PREPARED_BY}  |  Page ${currentPage} of ${pageCount}`,
		alignment: 'right',
		fontSize: pt(7),
		color: MUTED,
		font: FONT_HEADING
	};
}

function buildSectionFooter(
	occupiedPages: number[],
	signatures: Content,
	currentPage: number,
	pageCount: number
): Content {
	const lastPage = lastOccupiedPage(occupiedPages);
	const showSignatures = lastPage === undefined || currentPage === lastPage;
	return {
		margin: [PAGE_MARGIN, 0, PAGE_MARGIN, 0],
		stack: [
			showSignatures ? signatures : signatureSpacer(),
			{
				text: `${PREPARED_BY}  |  Page ${currentPage} of ${pageCount}`,
				alignment: 'right',
				fontSize: pt(7),
				color: MUTED,
				font: FONT_HEADING,
				margin: [0, pt(4), 0, 0]
			}
		]
	};
}

export type JobCardPdfOptions = {
	/** Base64 data URL for the plant logo; the masthead drops the slot when absent. */
	logoDataUrl?: string;
	/** Drawing images keyed by `JobCardDrawingRow.id`; missing keys print the empty placeholder. */
	drawingDataUrls?: Record<string, string>;
};

/** Build the job-card pdfmake document (Job Card through Shop Sketch). */
export function buildJobCardDocDefinition(
	detail: JobCardDetail,
	options: JobCardPdfOptions = {}
): TDocumentDefinitions {
	const logo = options.logoDataUrl;
	const drawingDataUrls = options.drawingDataUrls ?? {};

	return {
		pageSize: 'A4',
		pageOrientation: 'landscape',
		pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, FOOTER_BAND],
		info: {
			title: `Job Card ${text(detail.jcSrNo, detail.jobId)}`,
			subject: TITLE_JOB_CARD,
			creator: PREPARED_BY
		},
		defaultStyle: { font: FONT_BODY, fontSize: pt(10), color: INK, lineHeight: 1.2 },
		styles: {
			gridHead: {
				font: FONT_HEADING,
				bold: true,
				fontSize: pt(8),
				alignment: 'center',
				lineHeight: 1.2,
				fillColor: GREY
			},
			gridCell: { font: FONT_BODY, fontSize: pt(10), alignment: 'center' },
			gridTotal: {
				font: FONT_HEADING,
				bold: true,
				fontSize: pt(9.5),
				alignment: 'center',
				fillColor: GREY
			},
			signature: { font: FONT_BODY, bold: true, fontSize: pt(10) },
			cutNote: { font: FONT_BODY, bold: true, fontSize: pt(9) }
		},
		content: [
			sectionPage(
				TITLE_JOB_CARD,
				detail,
				logo,
				[buildMarkTable(detail.rows)],
				buildJobCardSignatures()
			),
			sectionPage(
				TITLE_MACHINE_SCHEDULE,
				detail,
				logo,
				[
					lede(MACHINE_LEDE),
					buildLoadingTable(detail.loadingRows),
					{
						text: OPERATION_LEGEND,
						font: FONT_HEADING,
						fontSize: pt(8),
						margin: [0, pt(6), 0, 0]
					}
				],
				buildSignRow(['Planning', 'Shop Supervisor', 'Date:'])
			),
			sectionPage(
				TITLE_STEEL_REQUISITION,
				detail,
				logo,
				[lede(REQUISITION_LEDE), buildRequisitionTable(detail.requisitionRows)],
				buildSignRow([
					'Requested By (Planning)',
					'Issued By (Steel Stores)',
					'Received By (Fabrication)',
					'Date:'
				])
			),
			sectionPage(
				TITLE_CUTTING_PLAN,
				detail,
				logo,
				[lede(CUTTING_LEDE), buildCuttingPlan(detail.cuttingRows)],
				buildSignRow(['Prepared By (Planning)', 'Approved By (HOD Planning)', 'Date:']),
				CUTTING_JOB_FIELD_PCT
			),
			...detail.drawings.map((drawing) =>
				sketchPage(detail, logo, drawing, drawingDataUrls[drawing.id])
			)
		]
	};
}

/** Filesystem-safe download name, mirroring the CSV export convention. */
export function jobCardPdfFileName(detail: Pick<JobCardDetail, 'jcSrNo' | 'jobId'>): string {
	const base = text(detail.jcSrNo, text(detail.jobId, 'detail'));
	return `job-card-${base}`.replace(/[^\w.-]+/g, '-');
}
