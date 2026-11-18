/** Session stash for OCR Generate → Mark Region (selected drawing subset). */

export type OcrGenerateSession = {
	bomId: string;
	drawingFileIds: string[];
	filenamesByFileId: Record<string, string>;
	projectId: string;
	structureKind: 'tower' | 'stub';
	structureId: string;
	/** Drawing set name for back-nav after Mark Region. */
	drawingSet?: string;
	/** When true, Mark Region / Results navigate back into the OCR app. */
	sourceApp: 'ocr' | 'pm';
};

const KEY = 'ifactory.ocr.generateSession';

export function writeOcrGenerateSession(session: OcrGenerateSession): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(session));
	} catch {
		// sessionStorage full / private mode — Mark Region falls back to whole-BOM rasterize
	}
}

export function readOcrGenerateSession(): OcrGenerateSession | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as OcrGenerateSession;
		if (!parsed?.bomId || !Array.isArray(parsed.drawingFileIds)) return null;
		return parsed;
	} catch {
		return null;
	}
}

/** Read session only when it matches the current BOM (ignore stale stash). */
export function readOcrGenerateSessionForBom(bomId: string): OcrGenerateSession | null {
	const session = readOcrGenerateSession();
	if (!session || session.bomId !== bomId) return null;
	return session;
}

export function clearOcrGenerateSession(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
