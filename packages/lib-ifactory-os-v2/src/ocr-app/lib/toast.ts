import { pushToast, type ToastOptions } from '@ifactory/ui-v2';
import {
	toastDurationMs,
	toastErrorDurationMs,
	toastSuccessDurationMs
} from '../../lib/toast-duration.js';

export function ocrPushToast(options: ToastOptions): string {
	return pushToast({ duration: toastDurationMs(), ...options });
}

export function ocrPushErrorToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastErrorDurationMs(), ...options, variant: 'error' });
}

export function ocrPushSuccessToast(options: Omit<ToastOptions, 'variant'>): string {
	return pushToast({ duration: toastSuccessDurationMs(), ...options, variant: 'success' });
}

/** @deprecated Prefer ocrPush* — aliases for code copied from PM OCR flow. */
export const pmPushToast = ocrPushToast;
export const pmPushErrorToast = ocrPushErrorToast;
export const pmPushSuccessToast = ocrPushSuccessToast;
