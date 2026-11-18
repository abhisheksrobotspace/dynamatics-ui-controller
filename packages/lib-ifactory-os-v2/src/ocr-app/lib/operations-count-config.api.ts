import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { DEFAULT_OCR_ENGINE } from './ocr.constants.js';

export type OperationsCountConfig = {
	markNumberRegex: string;
	ocrEngine: string;
	sampleMarkNumbers?: string[];
	metadata?: Record<string, unknown>;
};

type ProjContractorRow = {
	contractor_id: string;
	mark_number_regex?: string | null;
	sample_mark_numbers?: string[] | null;
	metadata?: Record<string, unknown>;
};

type ProjectLike = { contractorId?: string | null };

function mapContractorToConfig(row: ProjContractorRow | undefined): OperationsCountConfig {
	const metadata = row?.metadata ?? {};
	return {
		markNumberRegex: row?.mark_number_regex?.trim() ?? '',
		ocrEngine:
			typeof metadata.ocr_engine === 'string' && metadata.ocr_engine.trim()
				? metadata.ocr_engine.trim()
				: DEFAULT_OCR_ENGINE,
		sampleMarkNumbers: Array.isArray(row?.sample_mark_numbers)
			? (row.sample_mark_numbers as string[])
			: undefined,
		metadata
	};
}

export async function getOperationsCountConfig(
	contractorId: string,
	signal?: AbortSignal
): Promise<OperationsCountConfig> {
	const envelope = await apiClient.get<ApiEnvelope<ProjContractorRow[]>>(
		apiClient.datahub(`proj_contractors?contractor_id=${encodeURIComponent(contractorId)}`),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjContractorRow>(envelope.data)[0];
	return mapContractorToConfig(row);
}

/** Load OCR settings from the project's contractor. */
export async function loadOperationsCountConfig(
	project: ProjectLike,
	signal?: AbortSignal
): Promise<OperationsCountConfig> {
	if (!project.contractorId) {
		return {
			markNumberRegex: '',
			ocrEngine: DEFAULT_OCR_ENGINE
		};
	}
	return getOperationsCountConfig(project.contractorId, signal);
}
