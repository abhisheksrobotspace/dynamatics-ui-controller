type ParsedDuplicateDetail = {
	column: string;
	value: string;
};

type ConstraintMessageResolver = (detail: ParsedDuplicateDetail | null) => string;

const DUPLICATE_CONSTRAINT_MESSAGES: Record<string, ConstraintMessageResolver> = {
	proj_projects_name_unique: (detail) =>
		detail?.value
			? `A project named "${detail.value}" already exists.`
			: 'A project with this name already exists.',
	proj_customers_name_unique: (detail) =>
		detail?.value
			? `A customer named "${detail.value}" already exists.`
			: 'A customer with this name already exists.',
	proj_contractors_name_unique: (detail) =>
		detail?.value
			? `A contractor named "${detail.value}" already exists.`
			: 'A contractor with this name already exists.',
	uq_proj_structure: (detail) =>
		detail?.value
			? `A structure named "${detail.value}" already exists for this project.`
			: 'This structure already exists for the project.',
	uq_proj_bom_name: () => 'A BOM with this name already exists for this structure.'
};

const API_ERROR_MESSAGES: Record<string, string> = {
	'Entity not allowed': 'You do not have permission to perform this action.',
	'Operation not allowed': 'You do not have permission to perform this action.',
	'Not found': 'The requested record was not found.'
};

function extractPostgresSuffix(message: string): string {
	const arrowIndex = message.indexOf('←');
	return arrowIndex === -1 ? message : message.slice(arrowIndex + 1).trim();
}

function parseDuplicateDetail(suffix: string): ParsedDuplicateDetail | null {
	const match = suffix.match(/\(detail:\s*Key \(([^)]+)\)=\((.+)\) already exists\.?\)/i);
	if (!match) return null;
	return { column: match[1], value: match[2] };
}

function parseConstraintName(suffix: string): string | null {
	const match = suffix.match(/unique constraint "([^"]+)"/i);
	return match?.[1] ?? null;
}

function formatForeignKeyError(suffix: string): string | null {
	if (!suffix.includes('foreign key constraint')) return null;

	const isDeleteOrUpdateOfReferenced =
		/update or delete on table/i.test(suffix) || /is still referenced/i.test(suffix);

	if (suffix.includes('proj_projects_contractor_id_fkey')) {
		return isDeleteOrUpdateOfReferenced
			? 'This contractor is linked to one or more projects and cannot be deleted.'
			: 'The selected contractor is invalid or no longer exists.';
	}

	if (suffix.includes('proj_projects_customer_id_fkey')) {
		return isDeleteOrUpdateOfReferenced
			? 'This customer is linked to one or more projects and cannot be deleted.'
			: 'The selected customer is invalid or no longer exists.';
	}

	return isDeleteOrUpdateOfReferenced
		? 'This record is still in use and cannot be deleted.'
		: 'This record references data that is missing or no longer available.';
}

function formatNotNullError(suffix: string): string | null {
	if (!suffix.includes('null value in column')) return null;

	const match = suffix.match(/null value in column "([^"]+)"/i);
	if (!match) return 'Please fill in all required fields.';

	const columnLabels: Record<string, string> = {
		name: 'name',
		customer_id: 'customer',
		contractor_id: 'contractor'
	};

	const label = columnLabels[match[1]] ?? match[1].replace(/_/g, ' ');
	return `Please enter a ${label}.`;
}

export function formatDatahubErrorMessage(message: string): string {
	let trimmed = message.trim();
	if (!trimmed) return 'Something went wrong. Please try again.';

	const coreFetchMatch = trimmed.match(/^core \S+ \S+ failed \(\d+\): (.+)$/);
	if (coreFetchMatch?.[1]) trimmed = coreFetchMatch[1].trim();

	const knownApiMessage = API_ERROR_MESSAGES[trimmed];
	if (knownApiMessage) return knownApiMessage;

	const suffix = extractPostgresSuffix(trimmed);
	const constraint = parseConstraintName(suffix);
	const duplicateDetail = parseDuplicateDetail(suffix);

	if (constraint) {
		const resolver = DUPLICATE_CONSTRAINT_MESSAGES[constraint];
		if (resolver) return resolver(duplicateDetail);
	}

	if (suffix.includes('duplicate key')) {
		if (duplicateDetail?.value) {
			return `"${duplicateDetail.value}" already exists. Please use a different value.`;
		}
		return 'This value already exists. Please use a different value.';
	}

	const foreignKeyMessage = formatForeignKeyError(suffix);
	if (foreignKeyMessage) return foreignKeyMessage;

	const notNullMessage = formatNotNullError(suffix);
	if (notNullMessage) return notNullMessage;

	// Mass-stage drawing delete trigger — prefer HINT over the raw Postgres raise.
	if (/cannot delete drawing.*stage is mass/i.test(trimmed) || /stage is mass/i.test(suffix)) {
		const hintMatch =
			trimmed.match(/HINT:\s*(.+?)(?:\n|$)/i) ?? suffix.match(/HINT:\s*(.+?)(?:\n|$)/i);
		if (hintMatch?.[1]) return hintMatch[1].trim();
		return 'Create a new version of this BOM instead of editing the released one.';
	}

	if (trimmed.includes('←') || /\[\d{5}\]/.test(suffix)) {
		return 'Unable to save your changes. Please check your input and try again.';
	}

	return trimmed;
}
