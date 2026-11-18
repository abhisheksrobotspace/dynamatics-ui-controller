export const DELIVERY_SCHEDULE_EXPORT_HEADERS = [
	'Month',
	'Work Order',
	'Structures',
	'Mass / Proto',
	'Structures Details',
	'Batch wt',
	'Steel Indent No',
	'Steel Indent WT in MT',
	'Available Stock',
	'Received Qty. in MT',
	'Bal. Qty. in MT',
	'Rel. Bal.',
	'Fab. Bal.',
	'Gal. Bal.',
	'Ins. Bal',
	'Desp Bal.',
	'Plant',
	'Remark',
	'Zinc Req.'
] as const;

export type DeliveryScheduleExportBom = {
	name: string;
	qty: number;
	weightMt: string;
};

export type DeliveryScheduleExportLot = {
	month: string;
	workOrder: string;
	structureLabel: string;
	boms: DeliveryScheduleExportBom[];
	batchWt: string;
};

const MONTH_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
] as const;

function csvCell(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

function toCsvLine(cells: readonly string[]): string {
	return cells.map(csvCell).join(',');
}

function setWord(qty: number): string {
	return qty === 1 ? 'set' : 'sets';
}

/** `16.08.26` style stamp used in the download filename. */
export function formatExportUpdatedOn(date: Date): string {
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const year = String(date.getFullYear()).slice(-2);
	return `${day}.${month}.${year}`;
}

/** `Aug-26` from a schedule date stored as `DD/MM/YYYY`. */
export function formatExportMonth(ddMmYyyy: string): string {
	const [day, month, year] = ddMmYyyy.trim().split('/');
	const monthIndex = Number(month) - 1;
	const yearNumber = Number(year);
	if (!day || monthIndex < 0 || monthIndex > 11 || !Number.isFinite(yearNumber)) {
		return ddMmYyyy.trim();
	}
	return `${MONTH_SHORT[monthIndex]}-${String(yearNumber).slice(-2)}`;
}

export function formatStructureSetsLabel(structureName: string, setCount: number): string {
	const unit = setCount === 1 ? 'Set' : 'Sets';
	return `${structureName} - ${setCount} ${unit}`;
}

export function formatStructuresDetailsCell(
	bomName: string,
	qty: number,
	weightMt: string
): string {
	return `${bomName}: ${qty} ${setWord(qty)} (${weightMt} MT)`;
}

/** Sum formatted MT cells; `-` when nothing numeric. Whole numbers stay unpadded. */
export function formatBatchWt(weightMtValues: string[]): string {
	let total = 0;
	let hasValue = false;
	for (const value of weightMtValues) {
		if (value.trim() === '' || value === '-') continue;
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) continue;
		total += parsed;
		hasValue = true;
	}
	if (!hasValue) return '-';
	const rounded = Math.round(total * 100) / 100;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function sanitizeDeliveryScheduleExportFilename(name: string): string {
	const cleaned = name
		.trim()
		.replace(/[/\\?%*:|"<>]/g, '-')
		.replace(/\s+/g, ' ');
	return cleaned || 'Delivery Schedule';
}

export function deliveryScheduleExportFilename(projectName: string, updatedOn: string): string {
	const label = sanitizeDeliveryScheduleExportFilename(projectName);
	return `Delivery Schedule - ${label} - Updated ${updatedOn}.csv`;
}

/**
 * Steel Status header, then one row per BOM. Month / Work Order / Structures /
 * Batch wt only on the first BOM of each structure lot. Remark stays empty.
 */
export function buildDeliveryScheduleCsv(lots: DeliveryScheduleExportLot[]): string {
	const lines = [toCsvLine(DELIVERY_SCHEDULE_EXPORT_HEADERS)];
	for (const lot of lots) {
		lot.boms.forEach((bom, index) => {
			const isFirst = index === 0;
			lines.push(
				toCsvLine([
					isFirst ? lot.month : '',
					isFirst ? lot.workOrder : '',
					isFirst ? lot.structureLabel : '',
					'',
					formatStructuresDetailsCell(bom.name, bom.qty, bom.weightMt),
					isFirst ? lot.batchWt : '',
					'',
					'',
					'',
					'',
					'',
					'',
					'',
					'',
					'',
					'',
					'',
					'',
					''
				])
			);
		});
	}
	return lines.join('\r\n');
}
