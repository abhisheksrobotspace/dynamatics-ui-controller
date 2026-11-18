import { OCR_BASE } from './ocr.constants';

function formatOcrError(data: Record<string, unknown>, status: number): string {
	if (typeof data.error === 'string') return data.error;
	if (typeof data.detail === 'string') return data.detail;
	if (Array.isArray(data.detail)) {
		return data.detail
			.map((item) =>
				typeof item === 'object' && item && 'msg' in item ? String(item.msg) : String(item)
			)
			.join(', ');
	}
	return `OCR request failed (${status})`;
}

export async function ocrFetch<T = Record<string, unknown>>(
	path: string,
	init?: RequestInit
): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${OCR_BASE}${path}`, init);
	} catch {
		throw new Error(
			'Cannot reach the OCR server. Start it locally: cd python-server && source .venv/bin/activate && python main.py'
		);
	}

	const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	if (!res.ok) throw new Error(formatOcrError(data, res.status));
	if (typeof data.error === 'string') throw new Error(data.error);
	return data as T;
}

export function ocrStaticUrl(path: string): string {
	return `${OCR_BASE}${path}`;
}
