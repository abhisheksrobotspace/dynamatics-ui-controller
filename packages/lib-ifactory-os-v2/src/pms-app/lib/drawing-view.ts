/** Index in the viewable drawing list. Set before opening the view screen. */
let startIndex = 0;

export function openDrawingView(index: number): void {
	startIndex = index < 0 ? 0 : index;
}

export function drawingViewStartIndex(): number {
	return startIndex;
}
