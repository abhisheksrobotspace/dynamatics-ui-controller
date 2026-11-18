export type ImageViewerItem = {
	/** Caller key. The viewer does not interpret it. */
	id?: string;
	src: string;
	alt?: string;
	label?: string;
};

/** `hmi`: 1280×800 touch panel look (keycap buttons, large type). Default is unchanged. */
export type ImageViewerVariant = 'default' | 'hmi';

export interface ImageViewerProps {
	items?: ImageViewerItem[];
	index?: number;
	onError?: (item: ImageViewerItem) => void;
	/** Adds a close (X) key at the right end of the toolbar. Omit for no close key. */
	onClose?: () => void;
	variant?: ImageViewerVariant;
	class?: string;
}

export interface ImageFrameProps {
	item: ImageViewerItem;
	index: number;
	count: number;
	onPrevious?: () => void;
	onNext?: () => void;
	onError?: (item: ImageViewerItem) => void;
	onClose?: () => void;
	variant?: ImageViewerVariant;
	class?: string;
}
