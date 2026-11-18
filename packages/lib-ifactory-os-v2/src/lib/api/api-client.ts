import { datahubUrl, filesUrl, v1Url } from '../endpoints.js';
import { ApiError, toApiErrorFromBody } from './api-error.js';
import { formatDatahubErrorMessage, type ApiEnvelope } from './types.js';

const NETWORK_ERROR = 'Cannot reach the server. Check your connection.';

function isFormData(body: unknown): body is FormData {
	return typeof FormData !== 'undefined' && body instanceof FormData;
}

function assertOkResponse(data: Record<string, unknown>, res: Response): void {
	if (!res.ok || data.success === false) {
		const err = toApiErrorFromBody(data, res.status);
		// Forced password-change gate (USER_MANAGEMENT_UI_INTEGRATION.md §4B)
		if (err.code === 'auth.password_change_required' && typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('ifactory:password-change-required'));
		}
		// Legacy string errors may still be raw Postgres — scrape for display.
		if (typeof data.error === 'string') {
			throw new ApiError({
				code: err.code,
				message: formatDatahubErrorMessage(err.message),
				status: err.status,
				requestId: err.requestId,
				details: err.details,
				body: data
			});
		}
		throw err;
	}
	if (typeof data.error === 'string') {
		throw new ApiError({
			code: 'validation.failed',
			message: formatDatahubErrorMessage(data.error),
			status: res.status,
			body: data
		});
	}
}

/**
 * Singleton HTTP client for ifactoryai-core.
 * Always sends session cookies (`credentials: 'include'`).
 */
class ApiClient {
	private static instance: ApiClient | undefined;

	static getInstance(): ApiClient {
		ApiClient.instance ??= new ApiClient();
		return ApiClient.instance;
	}

	private constructor() {}

	/** Low-level authenticated fetch. Prefer `json`, `get`, `post`, etc. */
	async fetch(input: string, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers);

		if (!headers.has('Accept')) {
			headers.set('Accept', 'application/json');
		}

		if (init.body != null && !isFormData(init.body) && !headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}

		return fetch(input, {
			...init,
			credentials: 'include',
			headers
		});
	}

	/** Parse JSON and throw {@link ApiError} on HTTP or envelope failures. */
	async json<T = ApiEnvelope>(input: string, init?: RequestInit): Promise<T> {
		let res: Response;
		try {
			res = await this.fetch(input, init);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw error;
			}
			if (init?.signal?.aborted) {
				throw new DOMException('The operation was aborted.', 'AbortError');
			}
			throw new ApiError({
				code: 'datahub.upstream_unavailable',
				message: NETWORK_ERROR,
				status: 0
			});
		}

		const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		assertOkResponse(data, res);
		return data as T;
	}

	async get<T = ApiEnvelope>(url: string, init?: Omit<RequestInit, 'method' | 'body'>): Promise<T> {
		return this.json<T>(url, { ...init, method: 'GET' });
	}

	async post<T = ApiEnvelope>(
		url: string,
		body?: unknown,
		init?: Omit<RequestInit, 'method' | 'body'>
	): Promise<T> {
		return this.json<T>(url, {
			...init,
			method: 'POST',
			body: body == null ? undefined : isFormData(body) ? body : JSON.stringify(body)
		});
	}

	async patch<T = ApiEnvelope>(
		url: string,
		body?: unknown,
		init?: Omit<RequestInit, 'method' | 'body'>
	): Promise<T> {
		return this.json<T>(url, {
			...init,
			method: 'PATCH',
			body: body == null ? undefined : isFormData(body) ? body : JSON.stringify(body)
		});
	}

	async delete<T = ApiEnvelope>(
		url: string,
		init?: Omit<RequestInit, 'method' | 'body'>
	): Promise<T> {
		return this.json<T>(url, { ...init, method: 'DELETE' });
	}

	/** SOC / legacy `/api/v1/*` routes. */
	v1(path: string): string {
		return v1Url(path);
	}

	/** Datahub v2 CRUD and jobs — `/api/v2/datahub/*`. */
	datahub(path: string): string {
		return datahubUrl(path);
	}

	/** File service — `/api/v2/files/*`. */
	files(path: string): string {
		return filesUrl(path);
	}
}

export const apiClient = ApiClient.getInstance();
