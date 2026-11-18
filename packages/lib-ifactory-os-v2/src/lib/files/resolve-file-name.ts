import { apiClient } from '../api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../api/types.js';

/** Parse `Content-Disposition` for the original upload filename. */
export function filenameFromContentDisposition(header: string | null, fallback: string): string {
	if (!header) return fallback;
	const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
	if (utf8Match?.[1]) {
		try {
			return decodeURIComponent(utf8Match[1]);
		} catch {
			return utf8Match[1];
		}
	}
	const plainMatch = /filename="?([^"]+)"?/i.exec(header);
	return plainMatch?.[1]?.trim() || fallback;
}

type FileNameRow = {
	file_id: string;
	file_name?: string | null;
};

/**
 * Resolve display names from `files.file_name` via datahub (metadata only — never downloads bytes).
 * File-service GET ignores Range and would stream the whole object.
 */
export async function resolveFileNames(
	fileIds: string[],
	signal?: AbortSignal
): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	const unique = [...new Set(fileIds.filter(Boolean))];
	if (unique.length === 0) return out;

	const idList = unique.map((id) => encodeURIComponent(id)).join(',');
	try {
		const envelope = await apiClient.get<ApiEnvelope<FileNameRow[]>>(
			apiClient.datahub(
				`files?file_id__in=${idList}&select=file_id,file_name&limit=${Math.max(unique.length, 1)}`
			),
			{ signal }
		);
		for (const row of rowsFromEnvelope<FileNameRow>(envelope.data)) {
			const name = typeof row.file_name === 'string' ? row.file_name.trim() : '';
			if (row.file_id && name) out.set(row.file_id, name);
		}
	} catch {
		// Callers fall back to their own labels.
	}
	return out;
}

/** Resolve one display name from file metadata (no byte download). */
export async function resolveFileName(
	fileId: string,
	fallback: string,
	signal?: AbortSignal
): Promise<string> {
	const map = await resolveFileNames([fileId], signal);
	return map.get(fileId) ?? fallback;
}
