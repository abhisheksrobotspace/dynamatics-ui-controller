import { pushToast, type ToastOptions } from '@ifactory/ui-v2';
import {
	toastDurationMs,
	toastErrorDurationMs,
	toastSuccessDurationMs
} from '../../lib/toast-duration.js';

export function pushErrorToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastErrorDurationMs(), ...options, variant: 'error' });
}

export function pushSuccessToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastSuccessDurationMs(), ...options, variant: 'success' });
}

export function pushInfoToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastDurationMs(), ...options });
}
