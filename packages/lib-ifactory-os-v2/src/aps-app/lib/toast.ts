import { pushToast, type ToastOptions } from '@ifactory/ui-v2';
import {
	toastDurationMs,
	toastErrorDurationMs,
	toastSuccessDurationMs
} from '../../lib/toast-duration.js';

export function apsPushToast(options: ToastOptions): string {
	return pushToast({ duration: toastDurationMs(), ...options });
}

export function apsPushErrorToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastErrorDurationMs(), ...options, variant: 'error' });
}

export function apsPushSuccessToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastSuccessDurationMs(), ...options, variant: 'success' });
}
