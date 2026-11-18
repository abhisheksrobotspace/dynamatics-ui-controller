import type { HoleBox, HoleCrop, HoleImages } from './ocr.types';

/** Raw box from vision/orchestrator: `[x1,y1,x2,y2]` or `{x1,y1,x2,y2}`. */
export type RawHoleBox = HoleBox | [number, number, number, number] | number[];

/** Raw hole entry: plain box, or `{ box, confidence? }`. */
export type RawHoleEntry = RawHoleBox | { box: RawHoleBox; confidence?: number };

/** Coordinates-only hole_images metadata from datahub. */
export type StoredHoleImagesMeta = {
	width_px?: number;
	height_px?: number;
	total_holes?: number;
	parts?: Array<{
		part_idx: number;
		box: RawHoleBox;
		hole_count?: number;
		confidence?: number;
		holes?: RawHoleEntry[];
	}>;
};

export function normalizeHoleBox(raw: RawHoleBox | null | undefined): HoleBox | undefined {
	if (raw == null) return undefined;
	if (Array.isArray(raw)) {
		if (raw.length < 4) return undefined;
		const [x1, y1, x2, y2] = raw;
		if (![x1, y1, x2, y2].every((n) => typeof n === 'number' && Number.isFinite(n))) {
			return undefined;
		}
		return { x1, y1, x2, y2 };
	}
	const { x1, y1, x2, y2 } = raw;
	if (![x1, y1, x2, y2].every((n) => typeof n === 'number' && Number.isFinite(n))) {
		return undefined;
	}
	return { x1, y1, x2, y2 };
}

export function normalizeHoleEntry(raw: RawHoleEntry | null | undefined): HoleBox | undefined {
	if (raw == null) return undefined;
	if (typeof raw === 'object' && !Array.isArray(raw) && 'box' in raw) {
		return normalizeHoleBox(raw.box);
	}
	return normalizeHoleBox(raw as RawHoleBox);
}

export function translateBoxesPageToCrop(boxes: HoleBox[], partBox: HoleBox): HoleBox[] {
	const ox = partBox.x1;
	const oy = partBox.y1;
	return boxes.map((b) => ({
		x1: b.x1 - ox,
		y1: b.y1 - oy,
		x2: b.x2 - ox,
		y2: b.y2 - oy
	}));
}

export function translateBoxesCropToPage(boxes: HoleBox[], partBox: HoleBox): HoleBox[] {
	const ox = partBox.x1;
	const oy = partBox.y1;
	return boxes.map((b) => ({
		x1: b.x1 + ox,
		y1: b.y1 + oy,
		x2: b.x2 + ox,
		y2: b.y2 + oy
	}));
}

export function mapHoleImages(meta?: StoredHoleImagesMeta): HoleImages | undefined {
	const parts = meta?.parts ?? [];
	if (!meta || parts.length === 0) return undefined;

	return {
		width_px: meta.width_px,
		height_px: meta.height_px,
		crops: parts.map((part): HoleCrop => {
			const box = normalizeHoleBox(part.box);
			const hole_boxes = (part.holes ?? [])
				.map(normalizeHoleEntry)
				.filter((b): b is HoleBox => b != null);
			return {
				part_idx: part.part_idx,
				box,
				hole_boxes,
				hole_count: part.hole_count ?? hole_boxes.length
			};
		})
	};
}

/** Coordinates-only metadata written on hole-review save. */
export function holeMetadataForSave(row: { hole_images?: HoleImages }):
	| {
			width_px?: number;
			height_px?: number;
			parts: Array<{
				part_idx: number;
				box: HoleBox;
				hole_count: number;
				holes: HoleBox[];
			}>;
	  }
	| undefined {
	const images = row.hole_images;
	const crops = images?.crops ?? [];
	const parts = crops
		.filter((c): c is HoleCrop & { box: HoleBox } => Boolean(c.box))
		.map((crop) => ({
			part_idx: crop.part_idx,
			box: crop.box,
			hole_count: crop.hole_boxes?.length ?? crop.hole_count ?? 0,
			holes: crop.hole_boxes ?? []
		}));
	if (!parts.length) return undefined;

	return {
		...(images?.width_px != null ? { width_px: images.width_px } : {}),
		...(images?.height_px != null ? { height_px: images.height_px } : {}),
		parts
	};
}
