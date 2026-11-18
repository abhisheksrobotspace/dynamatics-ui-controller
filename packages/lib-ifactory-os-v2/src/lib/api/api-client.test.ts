import { afterEach, describe, expect, it, vi } from 'vitest';

const { apiClient } = await import('./api-client.js');

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ success: true, data: [] }),
			...response
		})
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('apiClient', () => {
	it('sends credentials and JSON headers on GET', async () => {
		mockFetch({});

		await apiClient.get('/api/v2/datahub/proj_projects');

		expect(fetch).toHaveBeenCalledWith('/api/v2/datahub/proj_projects', {
			method: 'GET',
			credentials: 'include',
			headers: expect.any(Headers)
		});

		const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Headers;
		expect(headers.get('Accept')).toBe('application/json');
		expect(headers.get('Content-Type')).toBeNull();
	});

	it('does not set Content-Type for FormData POST', async () => {
		mockFetch({});
		const form = new FormData();
		form.append('file', new Blob(['csv']), 'bom.csv');

		await apiClient.post('/api/v2/files', form);

		const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Headers;
		expect(headers.get('Content-Type')).toBeNull();
	});

	it('throws ApiError on HTTP failure (legacy string error)', async () => {
		mockFetch({
			ok: false,
			status: 403,
			json: async () => ({ success: false, error: 'Forbidden' })
		});

		await expect(apiClient.get('/api/v2/datahub/proj_projects')).rejects.toMatchObject({
			name: 'ApiError',
			code: 'auth.forbidden',
			message: 'Forbidden',
			status: 403
		});
	});

	it('throws ApiError with catalog code from nested envelope', async () => {
		mockFetch({
			ok: false,
			status: 409,
			json: async () => ({
				success: false,
				error: {
					code: 'db.unique_violation',
					message: 'This already exists. Please use a different value.',
					status: 409
				}
			})
		});

		await expect(apiClient.get('/api/v2/datahub/proj_projects')).rejects.toMatchObject({
			name: 'ApiError',
			code: 'db.unique_violation',
			message: 'This already exists. Please use a different value.',
			status: 409
		});
	});

	it('throws ApiError on success:false envelope', async () => {
		mockFetch({
			ok: true,
			status: 200,
			json: async () => ({ success: false, error: 'Validation failed' })
		});

		await expect(apiClient.get('/api/v2/datahub/proj_projects')).rejects.toMatchObject({
			name: 'ApiError',
			message: 'Validation failed',
			status: 200
		});
	});

	it('throws ApiError on network failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		await expect(apiClient.get('/api/v2/datahub/proj_projects')).rejects.toMatchObject({
			name: 'ApiError',
			code: 'datahub.upstream_unavailable',
			status: 0
		});
	});

	it('builds v1, datahub, and files URLs', () => {
		expect(apiClient.v1('users/me')).toBe('/api/v1/users/me');
		expect(apiClient.datahub('proj_projects')).toBe('/api/v2/datahub/proj_projects');
		expect(apiClient.files('abc-123')).toBe('/api/v2/files/abc-123');
	});
});
