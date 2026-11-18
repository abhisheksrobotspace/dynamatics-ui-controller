import { pushToast, type ToastOptions } from '@ifactory/ui-v2';
import {
	toastDurationMs,
	toastErrorDurationMs,
	toastSuccessDurationMs
} from '../../lib/toast-duration.js';

export function pmPushToast(options: ToastOptions): string {
	return pushToast({ duration: toastDurationMs(), ...options });
}

export function pmPushErrorToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastErrorDurationMs(), ...options, variant: 'error' });
}

export function pmPushSuccessToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastSuccessDurationMs(), ...options, variant: 'success' });
}
