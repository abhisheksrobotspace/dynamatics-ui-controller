import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/api-client.js', () => ({
	apiClient: {
		datahub: (path: string) => `/api/v2/datahub/${path}`,
		get: vi.fn()
	}
}));

import { apiClient } from '../api/api-client.js';
import { resolveFileName, resolveFileNames } from './resolve-file-name.js';

const get = vi.mocked(apiClient.get);

describe('resolveFileNames', () => {
	afterEach(() => {
		get.mockReset();
	});

	it('loads names from datahub files metadata (no file download)', async () => {
		get.mockResolvedValueOnce({
			success: true,
			data: [
				{ file_id: 'a', file_name: 'tower.pdf' },
				{ file_id: 'b', file_name: 'legs.pdf' }
			]
		});

		const map = await resolveFileNames(['a', 'b', 'a']);
		expect(map.get('a')).toBe('tower.pdf');
		expect(map.get('b')).toBe('legs.pdf');
		expect(get).toHaveBeenCalledTimes(1);
		expect(String(get.mock.calls[0]?.[0])).toContain('files?file_id__in=');
		expect(String(get.mock.calls[0]?.[0])).toContain('select=file_id,file_name');
	});

	it('falls back when metadata is missing', async () => {
		get.mockResolvedValueOnce({ success: true, data: [] });
		await expect(resolveFileName('missing', 'Drawing 1.pdf')).resolves.toBe('Drawing 1.pdf');
	});
});
