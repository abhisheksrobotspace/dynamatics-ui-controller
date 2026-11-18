import {
	invCreate,
	invCreateMany,
	invList,
	invTxn,
	invUpdate,
	isInvTxnUnavailable
} from './inv.api.js';
import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { applyUpload } from './inv.jobs.js';
import { num, numOrNull } from './inv.num.js';
import type { InvStockLineRow, InvStockUploadRow, InvStockUploadRowInput } from './inv.types.js';
import type { StockFilter } from './stock-register.types.js';
import { formatWeightMt } from './inv-views.api.js';

export type StockRegisterDisplayRow = {
	id: string;
	stock_line_id: string;
	item_id: string;
	project_id: string;
	plant_id: string;
	plant_label: string;
	project_label: string;
	item_code: string;
	/**
	 * BOM section for this line's project (`inv_stock_lines.bom_section`), as the BOM spells it.
	 * Display "No BOM section" when the server left it null (D5b).
	 */
	section: string;
	/** True when `bom_section` is set — lines without it cannot be locked against a section. */
	has_bom_section: boolean;
	bom_material_grade: string;
	/** ERP Item Description (`inv_items.name`). */
	description: string;
	unit: string;
	length_label: string;
	width_label: string;
	location_party: string;
	variant_key: string;
	bundle_no: string;
	batch: string;
	physical_location: string;
	/** ERP booked weight (kg) when present on the line. */
	weight_kg: number | null;
	qty_base: number;
	locked_base: number;
	free_base: number;
	base_uom: string;
	qty_label: string;
	closing_qty_mt_label: string;
	free_label: string;
	locked_label: string;
	locked_against: string;
};

export type StockUploadCsvRow = {
	plant_ref: string;
	/** CSV `Project #` verbatim — must match `project_map` keys. */
	project_ref: string;
	item_code: string;
	/** CSV `Description` (item name for auto-create). Warehouse Name stays in `raw`. */
	name: string;
	material_grade: string;
	qty: number;
	/** Always PCS for ERP Closing Nos (file Unit is MT column UoM — ignored). */
	qty_uom: string;
	lot_code: string;
	serial_no: string;
	expiry_date: string;
	length_mm: number | null;
	width_mm: number | null;
	thickness_mm: number | null;
	/** Location/Party code — identity. */
	location_ref: string;
	/** Yard slot attribute (Physical Location). */
	physical_location: string;
	bundle_no: string;
	/** Closing(Summ.) Qty. (MT). */
	weight_mt: number | null;
	remark: string;
	raw: Record<string, string>;
	validation_status: 'ok' | 'warning' | 'error';
	validation_code: string | null;
};

/** Length/width from variant key as mm with thousands separators (`L=12000` → `12,000`). */
function dimMmFromVariantKey(variantKey: string, prefix: 'L' | 'W'): string {
	const match = variantKey.match(new RegExp(`${prefix}=(\\d+(?:\\.\\d+)?)`, 'i'));
	if (!match) return '-';
	const mm = Number(match[1]);
	if (!Number.isFinite(mm) || mm <= 0) return '-';
	return Math.round(mm).toLocaleString('en-IN');
}

function lengthMmFromVariantKey(variantKey: string): number | null {
	const match = variantKey.match(/L=(\d+(?:\.\d+)?)/i);
	if (!match) return null;
	const mm = Number(match[1]);
	return Number.isFinite(mm) && mm > 0 ? mm : null;
}

function normalizeSectionKey(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Register Section column label for a line's `bom_section` (D5b). */
export const NO_BOM_SECTION_LABEL = 'No BOM section';

export function formatBomSectionLabel(bomSection: string | null | undefined): string {
	const section = bomSection?.trim();
	return section || NO_BOM_SECTION_LABEL;
}

export function bomSectionsMatch(
	left: string | null | undefined,
	right: string | null | undefined
): boolean {
	const a = left?.trim();
	const b = right?.trim();
	if (!a || !b) return false;
	return normalizeSectionKey(a) === normalizeSectionKey(b);
}

/** Post-upload toast fragments including D5b `rows_without_bom_section`. */
export function formatApplyUploadSummaryParts(input: {
	result: {
		rows_imported?: number;
		rows_rejected?: number;
		rows_warned?: number;
		lines_zeroed?: number;
		locks_released?: number;
		projects?: Array<{ rows_without_bom_section?: number }>;
		unresolved_projects?: unknown[];
	};
	invalidCount?: number;
	warnedCount?: number;
	projectMapSize?: number;
}): string[] {
	const { result } = input;
	const invalidCount = input.invalidCount ?? 0;
	const warnedCount = input.warnedCount ?? 0;
	const projectCount = result.projects?.length ?? input.projectMapSize ?? 0;
	const unresolved = result.unresolved_projects?.length ?? 0;
	const withoutBomSection = (result.projects ?? []).reduce(
		(sum, project) => sum + (project.rows_without_bom_section ?? 0),
		0
	);

	return [
		`${result.rows_imported ?? 0} imported`,
		result.rows_rejected || invalidCount
			? `${result.rows_rejected || invalidCount} rejected`
			: null,
		warnedCount || result.rows_warned ? `${warnedCount || result.rows_warned} warned` : null,
		withoutBomSection > 0
			? `${withoutBomSection} row${withoutBomSection === 1 ? '' : 's'} imported with no BOM section`
			: null,
		result.lines_zeroed ? `${result.lines_zeroed} zeroed` : null,
		result.locks_released ? `${result.locks_released} locks released` : null,
		`${projectCount} project${projectCount === 1 ? '' : 's'}`,
		unresolved ? `${unresolved} unresolved Project #` : null
	].filter((part): part is string => Boolean(part));
}

function closingWeightKg(input: {
	qtyBase: number;
	baseUom: string;
	variantKey: string;
	nominalWeight: number | null;
	weightBasis: string | null;
}): number | null {
	const uom = input.baseUom.trim().toUpperCase();
	if (uom === 'MT' || uom === 'TON' || uom === 'TONNE') return input.qtyBase * 1000;
	if (uom === 'KG' || uom === 'KGS') return input.qtyBase;
	if (input.nominalWeight == null || input.nominalWeight <= 0) return null;
	if (input.weightBasis === 'per_piece') return input.qtyBase * input.nominalWeight;
	if (input.weightBasis === 'per_metre') {
		const lengthMm = lengthMmFromVariantKey(input.variantKey);
		if (lengthMm == null) return null;
		return input.qtyBase * (lengthMm / 1000) * input.nominalWeight;
	}
	return null;
}

export async function listPlants(signal?: AbortSignal): Promise<PlantRow[]> {
	const rows = await invList<PlantRow & Record<string, unknown>>(
		'plants',
		{ select: 'plant_id,name,is_active', limit: 500 },
		signal
	);
	return rows
		.filter((row) => row.is_active !== false)
		.map((row) => ({ plant_id: row.plant_id, name: row.name, is_active: row.is_active }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Item master for client-side apply_upload parity (item-by-code only — D5). */
export async function listStockUploadValidationRefs(signal?: AbortSignal): Promise<{
	items: InvItemRow[];
}> {
	const items = await invList<InvItemRow & Record<string, unknown>>(
		'inv_items',
		{ select: 'item_id,item_code,stock_archetype,tracking_mode', limit: 5000 },
		signal
	);
	return {
		items: items.map((item) => ({
			item_id: item.item_id,
			item_code: item.item_code,
			stock_archetype: typeof item.stock_archetype === 'string' ? item.stock_archetype : undefined,
			tracking_mode: typeof item.tracking_mode === 'string' ? item.tracking_mode : undefined
		}))
	};
}

export async function listStockRegister(
	projectId: string | undefined,
	signal?: AbortSignal
): Promise<StockRegisterDisplayRow[]> {
	const select = [
		'stock_line_id',
		'item_id',
		'project_id',
		'plant_id',
		'location_ref',
		'physical_location',
		'bundle_no',
		'variant_key',
		'lot_code',
		'qty_base',
		'locked_base',
		'free_base',
		'base_uom',
		'weight_kg',
		'bom_section',
		'bom_material_grade',
		'i.item_code',
		'i.name',
		'pr.name',
		'pr.metadata',
		'pl.name',
		'd.nominal_weight',
		'd.weight_basis'
	].join(',');

	const lines = await datahubQuery<InvStockLineRow & Record<string, unknown>>(
		'inv_stock_lines',
		{
			select,
			...(projectId ? { project_id: projectId } : {}),
			joins: [
				leftJoin('inv_items', 'i', 'item_id', 'i.item_id'),
				leftJoin('proj_projects', 'pr', 'project_id', 'pr.project_id'),
				leftJoin('plants', 'pl', 'plant_id', 'pl.plant_id'),
				leftJoin('inv_item_dims', 'd', 'item_id', 'd.item_id')
			]
		},
		signal
	);
	if (lines.length === 0) return [];

	return lines.map((line) => {
		const qty = num(line.qty_base);
		const locked = num(line.locked_base);
		const free = num(line.free_base);
		const variantKey = line.variant_key?.trim() || '';
		const baseUom = line.base_uom || 'PCS';
		const weightBasisRaw = pickAlias(line, 'd', 'weight_basis');
		const erpWeightKg = numOrNull(line.weight_kg);
		const closingKg =
			erpWeightKg ??
			closingWeightKg({
				qtyBase: qty,
				baseUom,
				variantKey,
				nominalWeight: numOrNull(pickAlias(line, 'd', 'nominal_weight') as string | number | null),
				weightBasis: typeof weightBasisRaw === 'string' ? weightBasisRaw : null
			});
		const bomSection = typeof line.bom_section === 'string' ? line.bom_section.trim() : '';
		const hasBomSection = Boolean(bomSection);
		const metadata = (pickAlias(line, 'pr', 'metadata') ?? {}) as Record<string, unknown>;
		const workOrder =
			typeof metadata.work_order_no === 'string' ? metadata.work_order_no.trim() : '';
		const projectName = pickAliasString(line, 'pr', 'name').trim();
		const projectLabel = workOrder || projectName || line.project_id;
		const plantLabel = pickAliasString(line, 'pl', 'name').trim() || line.plant_id;
		const itemCode = pickAliasString(line, 'i', 'item_code').trim() || '-';
		const itemName = pickAliasString(line, 'i', 'name').trim() || '-';
		return {
			id: line.stock_line_id,
			stock_line_id: line.stock_line_id,
			item_id: line.item_id,
			project_id: line.project_id,
			plant_id: line.plant_id,
			plant_label: plantLabel,
			project_label: projectLabel,
			item_code: itemCode,
			section: formatBomSectionLabel(bomSection || null),
			has_bom_section: hasBomSection,
			bom_material_grade:
				typeof line.bom_material_grade === 'string' ? line.bom_material_grade.trim() || '-' : '-',
			description: itemName,
			unit: baseUom,
			length_label: dimMmFromVariantKey(variantKey, 'L'),
			width_label: dimMmFromVariantKey(variantKey, 'W'),
			location_party: line.location_ref?.trim() || '-',
			variant_key: variantKey,
			bundle_no: line.bundle_no?.trim() || '-',
			batch: line.lot_code?.trim() || '-',
			physical_location: line.physical_location?.trim() || '-',
			weight_kg: erpWeightKg,
			qty_base: qty,
			locked_base: locked,
			free_base: free,
			base_uom: baseUom,
			qty_label: String(qty),
			closing_qty_mt_label: formatWeightMt(closingKg),
			free_label: String(free),
			locked_label: String(locked),
			locked_against: '-'
		};
	});
}

export function rowMatchesStockFilter(row: StockRegisterDisplayRow, filter: StockFilter): boolean {
	switch (filter) {
		case 'free':
			return row.free_base > 0;
		case 'locked':
			return row.locked_base > 0;
		case 'sections':
			return row.has_bom_section;
		case 'plants':
			return Boolean(row.plant_id);
		default:
			return true;
	}
}

export async function projectHasStock(projectId: string, signal?: AbortSignal): Promise<boolean> {
	const rows = await invList<InvStockLineRow & Record<string, unknown>>(
		'inv_stock_lines',
		{ project_id: projectId, limit: 1, select: 'stock_line_id' },
		signal
	);
	return rows.length > 0;
}

export async function plantHasStock(plantId: string, signal?: AbortSignal): Promise<boolean> {
	const rows = await invList<InvStockLineRow & Record<string, unknown>>(
		'inv_stock_lines',
		{ plant_id: plantId, limit: 1, select: 'stock_line_id' },
		signal
	);
	return rows.length > 0;
}

/** Plant-scoped multi-project upload — one `inv_stock_uploads` + `project_map` (§3.4). */
export async function uploadAndApplyStockCsv(input: {
	plantId: string;
	/** CSV Project # → project_id (verbatim keys). */
	projectMap: Record<string, string>;
	/** Legacy single-project fallback when rows lack Project #. */
	projectId?: string | null;
	uploadedBy: string;
	rows: StockUploadCsvRow[];
	signal?: AbortSignal;
}) {
	const uploadId = crypto.randomUUID();
	const isInitialLoad = !(await plantHasStock(input.plantId, input.signal));

	await invCreate<InvStockUploadRow & Record<string, unknown>>(
		'inv_stock_uploads',
		{
			upload_id: uploadId,
			project_id: input.projectId?.trim() || null,
			plant_id: input.plantId,
			project_map: input.projectMap,
			status: 'draft',
			rows_total: input.rows.length,
			is_initial_load: isInitialLoad,
			uploaded_by: input.uploadedBy,
			scope_item_class: 'raw_material'
		},
		input.signal
	);

	const uploadRows: InvStockUploadRowInput[] = input.rows.map((row, index) => ({
		upload_row_id: crypto.randomUUID(),
		upload_id: uploadId,
		row_number: index + 1,
		raw: {
			...row.raw,
			...(row.project_ref ? { 'Project #': row.project_ref } : {})
		},
		plant_ref: row.plant_ref || null,
		project_ref: row.project_ref || null,
		item_code: row.item_code || null,
		name: row.name || null,
		material_grade: row.material_grade || null,
		qty: row.qty,
		qty_uom: 'PCS',
		lot_code: row.lot_code || null,
		serial_no: row.serial_no || null,
		expiry_date: row.expiry_date || null,
		length_mm: row.length_mm,
		width_mm: row.width_mm,
		thickness_mm: row.thickness_mm,
		location_ref: row.location_ref || null,
		physical_location: row.physical_location || null,
		bundle_no: row.bundle_no || null,
		weight_mt: row.weight_mt,
		remark: row.remark || null,
		validation_status: row.validation_status,
		validation_code: row.validation_code
	}));

	const CHUNK = 200;
	for (let i = 0; i < uploadRows.length; i += CHUNK) {
		await invCreateMany(
			'inv_stock_upload_rows',
			uploadRows.slice(i, i + CHUNK) as unknown as Record<string, unknown>[],
			input.signal
		);
	}

	const result = await applyUpload(uploadId, { signal: input.signal });
	return { uploadId, result };
}

export async function correctStockLineQty(input: {
	row: StockRegisterDisplayRow;
	qtyBase: number;
	lotCode?: string;
	locationRef?: string;
	physicalLocation?: string;
	bundleNo?: string;
	createdBy?: string;
	signal?: AbortSignal;
}): Promise<void> {
	const before = input.row.qty_base;
	const after = input.qtyBase;
	const delta = after - before;

	const linePatch: Record<string, unknown> = {
		qty_base: after
	};
	if (input.lotCode !== undefined) linePatch.lot_code = input.lotCode;
	if (input.locationRef !== undefined) linePatch.location_ref = input.locationRef;
	if (input.physicalLocation !== undefined) linePatch.physical_location = input.physicalLocation;
	if (input.bundleNo !== undefined) linePatch.bundle_no = input.bundleNo;

	const ledgerCreate = {
		stock_line_id: input.row.stock_line_id,
		item_id: input.row.item_id,
		project_id: input.row.project_id,
		plant_id: input.row.plant_id,
		movement_type: 'correction',
		qty_base_delta: delta,
		qty_before: before,
		qty_after: after,
		base_uom: input.row.base_uom,
		ref_type: 'manual',
		ref_label: 'Manual stock edit',
		created_by: input.createdBy ?? 'ui',
		note: 'Manual changes are logged'
	};

	try {
		await invTxn(
			[
				{ op: 'update', entity: 'inv_stock_lines', id: input.row.stock_line_id, data: linePatch },
				{ op: 'create', entity: 'inv_stock_ledger', data: ledgerCreate }
			],
			input.signal
		);
	} catch (error) {
		// ponytail: gateway has no /txn route yet - sequential CRUD
		if (!isInvTxnUnavailable(error)) throw error;
		await invUpdate('inv_stock_lines', input.row.stock_line_id, linePatch, input.signal);
		await invCreate('inv_stock_ledger', ledgerCreate, input.signal);
	}
}

export async function zeroStockLine(
	row: StockRegisterDisplayRow,
	createdBy?: string,
	signal?: AbortSignal
): Promise<void> {
	await correctStockLineQty({ row, qtyBase: 0, createdBy, signal });
}
