import { pushToast, type ToastOptions } from '@ifactory/ui-v2';
import {
	toastDurationMs,
	toastErrorDurationMs,
	toastSuccessDurationMs
} from '../../lib/toast-duration.js';

export function cpPushToast(options: ToastOptions): string {
	return pushToast({ duration: toastDurationMs(), ...options });
}

export function cpPushErrorToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastErrorDurationMs(), ...options, variant: 'error' });
}

export function cpPushSuccessToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastSuccessDurationMs(), ...options, variant: 'success' });
}
