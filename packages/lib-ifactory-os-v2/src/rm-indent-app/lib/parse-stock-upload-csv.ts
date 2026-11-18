import type { StockUploadCsvRow } from './stock-register.api.js';

function headerToSnake(header: string): string {
	return header
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

function normalizeHeader(header: string): string {
	return header.replace(/^\uFEFF/, '').trim();
}

function splitCsvLine(line: string): string[] {
	const columns: string[] = [];
	let current = '';
	let insideQuotes = false;

	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		const nextChar = line[index + 1];

		if (char === '"') {
			if (insideQuotes && nextChar === '"') {
				current += '"';
				index += 1;
				continue;
			}
			insideQuotes = !insideQuotes;
			continue;
		}

		if (char === ',' && !insideQuotes) {
			columns.push(current.trim());
			current = '';
			continue;
		}

		current += char;
	}

	columns.push(current.trim());
	return columns;
}

/**
 * Map CSV headers → upload field keys (§3.4).
 * `Unit` is intentionally unmapped (qty_uom fixed to PCS).
 * ERP warehouse `Name` stays in `raw` only — `Description` → `name`.
 */
const FIELD_ALIASES: Record<
	string,
	keyof Omit<StockUploadCsvRow, 'raw' | 'validation_status' | 'validation_code'>
> = {
	plant: 'plant_ref',
	plant_ref: 'plant_ref',
	primary_location: 'plant_ref',
	project: 'project_ref',
	project_ref: 'project_ref',
	item: 'item_code',
	item_code: 'item_code',
	item_code_colon: 'item_code',
	/** ERP Description (+ legacy Section) → item name for auto-create. */
	description: 'name',
	section: 'name',
	grade: 'material_grade',
	material_grade: 'material_grade',
	qty: 'qty',
	quantity: 'qty',
	closing_summ_nos: 'qty',
	uom: 'qty_uom',
	qty_uom: 'qty_uom',
	batch: 'lot_code',
	lot_code: 'lot_code',
	serial: 'serial_no',
	serial_no: 'serial_no',
	expiry: 'expiry_date',
	expiry_date: 'expiry_date',
	length: 'length_mm',
	length_mm: 'length_mm',
	width: 'width_mm',
	width_mm: 'width_mm',
	thickness: 'thickness_mm',
	thk: 'thickness_mm',
	thickness_mm: 'thickness_mm',
	location: 'location_ref',
	location_ref: 'location_ref',
	location_party: 'location_ref',
	party: 'location_ref',
	physical_location: 'physical_location',
	bundle: 'bundle_no',
	bundle_no: 'bundle_no',
	bundle_no_dot: 'bundle_no',
	remark: 'remark',
	closing_summ_qty_mt: 'weight_mt'
};

function resolveField(header: string): string | null {
	const normalized = normalizeHeader(header);
	const snake = headerToSnake(normalized);
	if (FIELD_ALIASES[snake]) return FIELD_ALIASES[snake];
	if (FIELD_ALIASES[normalized.toLowerCase()]) return FIELD_ALIASES[normalized.toLowerCase()];
	return null;
}

/** Mirrors worker-host `plantMatchKey`. */
export function plantMatchKey(ref: string): string {
	return ref.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Mirrors worker-host `projectRefKey`. */
export function projectRefKey(ref: string): string {
	return ref.toUpperCase().replace(/[^A-Z0-9/]+/g, '');
}

function parseDimMm(value: string): number | null {
	const cleaned = value.trim().replace(/,/g, '');
	if (!cleaned) return null;
	const meters = cleaned.match(/^([\d.]+)\s*m$/i);
	if (meters) {
		const n = Number(meters[1]);
		return Number.isFinite(n) ? Math.round(n * 1000) : null;
	}
	const n = Number(cleaned.replace(/[^\d.-]/g, ''));
	if (!Number.isFinite(n)) return null;
	return n < 100 ? Math.round(n * 1000) : Math.round(n);
}

/** Strict qty parse — mirrors worker `parseQty` (no comma thousands). */
function parseQty(value: string): number | undefined {
	const s = value.trim();
	if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
	const parsed = Number(s);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** Mirrors worker-host `variantKeyOf`. */
export function variantKeyOf(lengthMm: number, widthMm: number): string {
	const parts: string[] = [];
	if (lengthMm > 0) parts.push(`L=${lengthMm}`);
	if (widthMm > 0) parts.push(`W=${widthMm}`);
	return parts.join(';');
}

export type StockUploadPlantRef = {
	plant_id: string;
	name: string;
};

export type StockUploadItemRef = {
	item_id: string;
	item_code: string;
	stock_archetype?: string | null;
	tracking_mode?: string | null;
};

export type ParseStockUploadOptions = {
	plants: StockUploadPlantRef[];
	/**
	 * Upload's plant_id. Non-blank CSV plant_ref must resolve to this plant.
	 * When omitted (file picked before plant), plant checks are skipped.
	 */
	uploadPlantId?: string;
	/**
	 * Stamp every row's plant_ref (selected plant id/name) so ERP Primary Location
	 * display names that don't plantMatchKey the plant still apply under this plant.
	 */
	plantRefOverride?: string;
	items?: StockUploadItemRef[];
	/** When set, mark refs absent from the map as `inv.row_unknown_project`. */
	projectMap?: Record<string, string>;
};

export class StockUploadCsvError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StockUploadCsvError';
	}
}

type DraftRow = Omit<StockUploadCsvRow, 'validation_status' | 'validation_code'> & {
	validation_status: 'ok' | 'warning' | 'error';
	validation_code: string | null;
};

function resolveMappedProjectId(
	projectRef: string,
	projectMap: Record<string, string> | undefined
): string | null {
	if (!projectMap || !projectRef.trim()) return null;
	const want = projectRefKey(projectRef);
	for (const [ref, id] of Object.entries(projectMap)) {
		if (id.trim() && projectRefKey(ref) === want) return id.trim();
	}
	return null;
}

function plantRefMatchesUpload(
	plantRef: string,
	uploadPlantId: string,
	plants: StockUploadPlantRef[]
): boolean {
	const upload = plants.find((plant) => plant.plant_id === uploadPlantId);
	if (!upload) return false;
	const key = plantMatchKey(plantRef);
	if (!key) return true;
	return key === plantMatchKey(upload.plant_id) || key === plantMatchKey(upload.name);
}

/**
 * Parse + validate stock upload CSV using the same rejection codes as
 * `apply_upload` (inv.row_*). Rows marked `error` are still returned so the
 * sidecar can count them as rejected without re-checking.
 */
export async function parseStockUploadCsvFile(
	file: File,
	options: ParseStockUploadOptions
): Promise<StockUploadCsvRow[]> {
	const text = await file.text();
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (lines.length < 2) {
		throw new StockUploadCsvError('CSV must include a header row and at least one data row.');
	}

	const headers = splitCsvLine(lines[0]).map(normalizeHeader);
	const fieldByIndex = headers.map((header) => resolveField(header));
	if (!fieldByIndex.some(Boolean)) {
		throw new StockUploadCsvError('CSV headers were not recognized.');
	}

	const items = options.items ?? [];
	const itemByCode = new Map(items.map((item) => [item.item_code.toLowerCase(), item]));
	const plantOverride = options.plantRefOverride?.trim() || '';
	const uploadPlantId = options.uploadPlantId?.trim() || '';
	const projectMap = options.projectMap;

	const seenIdentity = new Set<string>();
	const rows: DraftRow[] = [];

	for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
		const cells = splitCsvLine(lines[lineIndex]);
		const raw: Record<string, string> = {};
		const values: Record<string, string> = {};

		headers.forEach((header, index) => {
			const cell = cells[index] ?? '';
			raw[header] = cell;
			const field = fieldByIndex[index];
			if (field) {
				// Prefer first non-empty Description/Section for `name`.
				if (field === 'name') {
					if (values.name?.trim() || !cell.trim()) return;
				}
				values[field] = cell;
			}
		});

		const qtyRaw = values.qty?.trim() ?? '';
		const qty = qtyRaw === '' ? undefined : parseQty(qtyRaw);
		const lengthMm = values.length_mm ? parseDimMm(values.length_mm) : null;
		const widthMm = values.width_mm ? parseDimMm(values.width_mm) : null;
		const thicknessMm = values.thickness_mm ? parseDimMm(values.thickness_mm) : null;
		const lengthNum = lengthMm ?? 0;
		const widthNum = widthMm ?? 0;
		const weightRaw = values.weight_mt?.trim() ?? '';
		const weightMt = weightRaw === '' ? null : Number(weightRaw.replace(/,/g, ''));

		const draft: DraftRow = {
			plant_ref: plantOverride || values.plant_ref?.trim() || '',
			project_ref: values.project_ref?.trim() || '',
			item_code: values.item_code?.trim() || '',
			name: values.name?.trim() || '',
			material_grade: values.material_grade?.trim() || '',
			qty: qty ?? 0,
			qty_uom: 'PCS',
			lot_code: values.lot_code?.trim() || '',
			serial_no: values.serial_no?.trim() || '',
			expiry_date: values.expiry_date?.trim() || '',
			length_mm: lengthMm,
			width_mm: widthMm,
			thickness_mm: thicknessMm,
			location_ref: values.location_ref?.trim() || '',
			physical_location: values.physical_location?.trim() || '',
			bundle_no: values.bundle_no?.trim() || '',
			weight_mt: weightMt != null && Number.isFinite(weightMt) ? weightMt : null,
			remark: values.remark?.trim() || '',
			raw,
			validation_status: 'ok',
			validation_code: null
		};

		const markError = (code: string) => {
			draft.validation_status = 'error';
			draft.validation_code = code;
		};
		const markWarning = (code: string) => {
			if (draft.validation_status === 'error') return;
			draft.validation_status = 'warning';
			draft.validation_code = code;
		};

		if (uploadPlantId && draft.plant_ref) {
			if (!plantRefMatchesUpload(draft.plant_ref, uploadPlantId, options.plants)) {
				markError('inv.row_unknown_plant');
				rows.push(draft);
				continue;
			}
		}

		if (projectMap && draft.project_ref && !resolveMappedProjectId(draft.project_ref, projectMap)) {
			markError('inv.row_unknown_project');
			rows.push(draft);
			continue;
		}

		if (qty === undefined) {
			markError('inv.row_invalid_qty');
			rows.push(draft);
			continue;
		}

		// Item BY CODE only (D5) — no alias mint / lookup.
		const code = draft.item_code;
		if (!code) {
			markError('inv.row_unknown_item');
			rows.push(draft);
			continue;
		}

		let item: StockUploadItemRef | undefined = itemByCode.get(code.toLowerCase());
		if (!item) {
			item = {
				item_id: '',
				item_code: code,
				stock_archetype: lengthNum > 0 ? (widthNum > 0 ? 'sheet' : 'linear') : 'discrete',
				tracking_mode: draft.lot_code ? 'lot' : 'none'
			};
			markWarning('inv.row_item_autocreated');
		}

		const archetype = item.stock_archetype ?? 'discrete';
		if ((archetype === 'linear' || archetype === 'sheet') && lengthNum <= 0) {
			markError('inv.row_missing_dims');
			rows.push(draft);
			continue;
		}

		const tracking = item.tracking_mode ?? 'none';
		if ((tracking === 'lot' || tracking === 'lot_and_serial') && !draft.lot_code) {
			markError('inv.row_missing_lot');
			rows.push(draft);
			continue;
		}

		const projectId = resolveMappedProjectId(draft.project_ref, projectMap) ?? '';
		const identityKey = [
			projectId,
			uploadPlantId || draft.plant_ref,
			item.item_code.toLowerCase(),
			variantKeyOf(lengthNum, widthNum),
			draft.lot_code,
			draft.serial_no,
			draft.bundle_no,
			draft.location_ref
		].join('\u0000');
		if (seenIdentity.has(identityKey)) {
			markError('inv.row_duplicate');
			rows.push(draft);
			continue;
		}
		seenIdentity.add(identityKey);

		rows.push(draft);
	}

	return rows;
}

/** ERP stock snapshot template — verbatim headers from Data Template.csv (27 columns). */
export const STOCK_UPLOAD_TEMPLATE_HEADERS = [
	'Primary Location',
	'Location Code',
	'Project #',
	'Project Description',
	'Item',
	'Description',
	'Unit',
	'Length',
	'Width',
	'Location/Party',
	'Name',
	'Batch',
	'Physical Location',
	'Bundle No.',
	'Opening Nos.',
	'Opening Qty.(MT)',
	'Opening Value',
	'Receipt Nos.',
	'Receipt Qty.(MT)',
	'Receipt Value',
	'Issue Nos.',
	'Issue Qty.(MT)',
	'Issue Value',
	'Closing(Summ.) Nos.',
	'Closing(Summ.) Qty. (MT)',
	'Closing(Summ.) Value.',
	'Closing(Summ.) Rate. (MT)'
] as const;

export type StockUploadTemplateHeader = (typeof STOCK_UPLOAD_TEMPLATE_HEADERS)[number];

/** Stable keys for preview rows — one per ERP header, in the same order. */
export const STOCK_UPLOAD_PREVIEW_KEYS = [
	'primary_location',
	'location_code',
	'project',
	'project_description',
	'item',
	'description',
	'unit',
	'length',
	'width',
	'location_party',
	'name',
	'batch',
	'physical_location',
	'bundle_no',
	'opening_nos',
	'opening_qty_mt',
	'opening_value',
	'receipt_nos',
	'receipt_qty_mt',
	'receipt_value',
	'issue_nos',
	'issue_qty_mt',
	'issue_value',
	'closing_nos',
	'closing_mt',
	'closing_value',
	'closing_rate_mt'
] as const;

export type StockUploadPreviewKey = (typeof STOCK_UPLOAD_PREVIEW_KEYS)[number];

/** Preview columns for the upload dialog (headers match the ERP template). */
export type StockUploadPreviewRow = { id: string } & Record<StockUploadPreviewKey, string>;

export function stockUploadPreviewTableColumns(): Array<{
	type: 'text';
	key: StockUploadPreviewKey;
	header: StockUploadTemplateHeader;
	value: (row: StockUploadPreviewRow) => string;
}> {
	return STOCK_UPLOAD_TEMPLATE_HEADERS.map((header, index) => {
		const key = STOCK_UPLOAD_PREVIEW_KEYS[index]!;
		return {
			type: 'text' as const,
			key,
			header,
			value: (row: StockUploadPreviewRow) => row[key]
		};
	});
}

export type StockUploadProjectCodeCount = {
	project_ref: string;
	row_count: number;
	/** Rows with Closing Nos > 0 (live stock, not exhausted history). */
	stock_row_count: number;
};

/** Download ERP header row only — same columns as Data Template.csv. */
export function downloadStockUploadTemplate(fileName = 'Data Template.csv'): void {
	const csv = `\uFEFF${STOCK_UPLOAD_TEMPLATE_HEADERS.join(',')}\n`;
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	document.body.append(anchor);
	try {
		anchor.click();
	} finally {
		anchor.remove();
		URL.revokeObjectURL(url);
	}
}

/** Distinct non-empty `Project #` values with row counts (sorted by code). */
export function collectStockUploadProjectCodes(
	rows: Pick<StockUploadCsvRow, 'project_ref' | 'qty'>[]
): StockUploadProjectCodeCount[] {
	const counts = new Map<string, { row_count: number; stock_row_count: number }>();
	for (const row of rows) {
		const code = row.project_ref?.trim() || '';
		if (!code) continue;
		const entry = counts.get(code) ?? { row_count: 0, stock_row_count: 0 };
		entry.row_count += 1;
		if (row.qty > 0) entry.stock_row_count += 1;
		counts.set(code, entry);
	}
	return [...counts.entries()]
		.map(([project_ref, countsForRef]) => ({ project_ref, ...countsForRef }))
		.sort((a, b) => a.project_ref.localeCompare(b.project_ref));
}

/** Drop empty mappings; keys stay verbatim CSV Project # strings. */
export function buildStockUploadProjectMap(
	mapping: Record<string, string>
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [ref, id] of Object.entries(mapping)) {
		const projectRef = ref.trim();
		const projectId = id.trim();
		if (projectRef && projectId) out[projectRef] = projectId;
	}
	return out;
}

/** Prefill Project # → project_id from `metadata.work_order_no` (UI suggestion only). */
export function suggestStockUploadProjectMapping(
	projectRefs: string[],
	projects: Array<{ project_id: string; work_order_no?: string | null }>
): Record<string, string> {
	const byKey = new Map<string, string>();
	for (const project of projects) {
		const key = projectRefKey(project.work_order_no ?? '');
		if (key && !byKey.has(key)) byKey.set(key, project.project_id);
	}
	const out: Record<string, string> = {};
	for (const ref of projectRefs) {
		out[ref] = byKey.get(projectRefKey(ref)) ?? '';
	}
	return out;
}

function emptyPreviewRow(id: string): StockUploadPreviewRow {
	const row = { id } as StockUploadPreviewRow;
	for (const key of STOCK_UPLOAD_PREVIEW_KEYS) row[key] = '-';
	return row;
}

/** Map CSV header snake → preview key (ERP names + legacy aliases). */
const PREVIEW_HEADER_TO_KEY: Record<string, StockUploadPreviewKey> = {
	...Object.fromEntries(
		STOCK_UPLOAD_TEMPLATE_HEADERS.map((header, index) => [
			headerToSnake(header),
			STOCK_UPLOAD_PREVIEW_KEYS[index]!
		])
	),
	plant: 'primary_location',
	plant_ref: 'primary_location',
	project_ref: 'project',
	item_code: 'item',
	section: 'description',
	qty: 'closing_nos',
	quantity: 'closing_nos',
	uom: 'unit',
	qty_uom: 'unit',
	lot_code: 'batch',
	location: 'location_party',
	location_ref: 'location_party',
	party: 'location_party',
	bundle: 'bundle_no'
};

/**
 * First N data rows mapped to all ERP template columns (raw cell values).
 */
export async function previewStockUploadCsv(
	file: File,
	options?: { maxRows?: number }
): Promise<StockUploadPreviewRow[]> {
	const maxRows = options?.maxRows ?? 5;
	const text = await file.text();
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (lines.length < 2) return [];

	const headers = splitCsvLine(lines[0]).map(normalizeHeader);
	const keyByIndex = headers.map((header) => PREVIEW_HEADER_TO_KEY[headerToSnake(header)] ?? null);

	const preview: StockUploadPreviewRow[] = [];
	for (let lineIndex = 1; lineIndex < lines.length && preview.length < maxRows; lineIndex += 1) {
		const cells = splitCsvLine(lines[lineIndex]);
		const row = emptyPreviewRow(String(preview.length));
		headers.forEach((_, index) => {
			const key = keyByIndex[index];
			const cell = cells[index] ?? '';
			if (!key || !cell.trim()) return;
			// Prefer first non-empty value when aliases collide.
			if (row[key] !== '-') return;
			row[key] = cell.trim();
		});
		preview.push(row);
	}

	return preview;
}
