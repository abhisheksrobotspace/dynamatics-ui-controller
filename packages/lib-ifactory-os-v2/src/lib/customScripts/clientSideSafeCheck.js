export function isClientSideSafe() {
	return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}
