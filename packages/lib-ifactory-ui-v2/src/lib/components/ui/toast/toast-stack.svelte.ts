import type { ToastEntry, ToastOptions } from './toast.constants';

export const toastStack = $state<ToastEntry[]>([]);

export function pushToast(options: ToastOptions): string {
	const id = crypto.randomUUID();
	toastStack.unshift({ id, ...options });
	return id;
}

export function dismissToast(id: string) {
	const index = toastStack.findIndex((toast) => toast.id === id);
	if (index !== -1) toastStack.splice(index, 1);
}

export function clearToasts() {
	toastStack.length = 0;
}
