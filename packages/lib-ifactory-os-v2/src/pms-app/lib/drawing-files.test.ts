import { describe, expect, it } from 'vitest';
import {
	drawingFetchForDest,
	drawingFetchMessage,
	drawingFetchesFromCard,
	drawingStatusCopy,
	parseDrawingFileNotice,
	shouldRefetchDrawing
} from './drawing-files.js';

const FILE = '5527a330-f866-4de1-834e-9ab22504a969';
const SHA = '3082bd173dc96ba588183804b857d197044b3bf42b7d2127195bcdb45ac38d99';

function artifact(over: Record<string, unknown> = {}) {
	return {
		kind: 'drawing',
		markNo: 'J48-4C 1609H',
		fileId: FILE,
		mime: 'image/png',
		sha256: SHA,
		sizeBytes: 1560645,
		url: 'https://signed.example/do-not-show',
		expiresAt: '2099-01-01T00:00:00.000Z',
		...over
	};
}

describe('drawingFetchesFromCard', () => {
	it('builds one fetch per file and keeps the signed url only on that payload', () => {
		const fetches = drawingFetchesFromCard({
			jobId: 'job-1',
			artifacts: [artifact(), artifact({ markNo: 'J48-4C 1610H' })]
		});
		expect(fetches).toEqual([
			{
				dest: `jobs/job-1/${FILE}.png`,
				url: 'https://signed.example/do-not-show',
				sha256: SHA,
				sizeBytes: 1560645
			}
		]);
		const message = drawingFetchMessage(fetches[0]!, 'req-1');
		expect(message.topic).toBe('/rt/files/fetch');
		expect(message.body.dest).toBe(`jobs/job-1/${FILE}.png`);
		expect(message.body.url).toBe('https://signed.example/do-not-show');
	});

	it('skips an expired link and a file the runtime would refuse', () => {
		const fetches = drawingFetchesFromCard({
			jobId: 'job-1',
			artifacts: [
				artifact({ expiresAt: '2000-01-01T00:00:00.000Z' }),
				artifact({ fileId: 'file-b', sha256: 'abc', url: 'http://insecure.example/x' })
			]
		});
		expect(fetches).toEqual([]);
	});
});

describe('drawing file status', () => {
	it('reads result and changed events and ignores the fetch topic', () => {
		expect(
			parseDrawingFileNotice('/rt/files/result', {
				requestId: 'req-1',
				dest: 'jobs/job-1/file.png',
				status: 'ready',
				url: 'https://signed.example/do-not-show'
			})
		).toEqual({ dest: 'jobs/job-1/file.png', status: 'ready' });
		expect(
			parseDrawingFileNotice('/rt/files/changed', {
				dest: 'jobs/job-1/file.png',
				status: 'failed',
				error: 'disk_full'
			})
		).toEqual({ dest: 'jobs/job-1/file.png', status: 'failed', error: 'disk_full' });
		expect(
			parseDrawingFileNotice('/rt/files/fetch', {
				url: 'https://signed.example/do-not-show',
				dest: 'jobs/job-1/file.png'
			})
		).toBeNull();
	});

	it('maps runtime status onto the operator copy', () => {
		expect(drawingStatusCopy({ expired: false, hasFile: true })).toBe('downloading…');
		expect(drawingStatusCopy({ expired: false, hasFile: true, status: 'ready' })).toBeNull();
		expect(drawingStatusCopy({ expired: true, hasFile: true, status: 'ready' })).toBe(
			'drawing link expired — ask planning to republish'
		);
		expect(
			drawingStatusCopy({ expired: false, hasFile: true, status: 'failed', error: 'forbidden' })
		).toBe('drawing link expired — ask planning to republish');
		expect(
			drawingStatusCopy({ expired: false, hasFile: true, status: 'failed', error: 'disk_full' })
		).toBe('device storage full');
		expect(
			drawingStatusCopy({ expired: false, hasFile: true, status: 'failed', error: 'io' })
		).toBe('drawing not available');
	});

	it('refetches a missing or retryable file and leaves an expired link alone', () => {
		expect(shouldRefetchDrawing({ expired: false, status: 'absent' })).toBe(true);
		expect(shouldRefetchDrawing({ expired: false, status: 'failed', error: 'disk_full' })).toBe(
			true
		);
		expect(shouldRefetchDrawing({ expired: false, status: 'failed', error: 'forbidden' })).toBe(
			false
		);
		expect(shouldRefetchDrawing({ expired: true, status: 'absent' })).toBe(false);
		expect(
			drawingFetchForDest({ jobId: 'job-1', artifacts: [artifact()] }, `jobs/job-1/${FILE}.png`)
				?.dest
		).toBe(`jobs/job-1/${FILE}.png`);
	});
});
