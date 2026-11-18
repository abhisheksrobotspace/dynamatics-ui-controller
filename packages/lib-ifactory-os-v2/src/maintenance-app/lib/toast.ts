import { pushToast, type ToastOptions } from '@ifactory/ui-v2';
import { toastErrorDurationMs, toastSuccessDurationMs } from '../../lib/toast-duration.js';

export function pushErrorToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastErrorDurationMs(), ...options, variant: 'error' });
}

export function pushSuccessToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastSuccessDurationMs(), ...options, variant: 'success' });
}
