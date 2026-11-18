import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

const client = vi.hoisted(() => {
	const handlers = new Map<string, Handler>();
	return {
		handlers,
		connected: true,
		/** Publish callbacks, held so a test can decide when the broker acknowledges. */
		acks: [] as Array<(err?: Error) => void>,
		published: [] as Array<{ topic: string; message: string }>,
		on(event: string, handler: Handler) {
			handlers.set(event, handler);
			return this;
		},
		publish(topic: string, message: string, _options: unknown, cb: (err?: Error) => void) {
			this.published.push({ topic, message });
			this.acks.push(cb);
		},
		subscribe: vi.fn(),
		end: vi.fn()
	};
});

vi.mock('mqtt', () => ({ default: { connect: () => client } }));

import { Runtime } from './runtime.js';

function deliver(topic: string, body: unknown) {
	client.handlers.get('message')?.(topic, Buffer.from(JSON.stringify(body)));
}

function lastRequestId(): string {
	const last = client.published.at(-1);
	return (JSON.parse(last?.message ?? '{}') as { requestId: string }).requestId;
}

describe('Runtime KV operations', () => {
	let runtime: Runtime;

	beforeEach(() => {
		vi.useFakeTimers();
		client.published.length = 0;
		client.acks.length = 0;
		runtime = new Runtime('test');
		client.handlers.get('connect')?.();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('ignores the echo of its own request and resolves on /result', async () => {
		const result = runtime.get('machineSettings');
		const requestId = lastRequestId();
		client.acks.at(-1)?.();

		// The broker sends our own publish back to us: same requestId, the request's `data`.
		deliver('/rt/db/machineSettings/get', { requestId, operation: 'get', data: {} });
		deliver('/rt/db/machineSettings/result', {
			requestId,
			operation: 'get',
			status: 'success',
			data: { 'aid-1': { aid: 'aid-1', name: 'Test Machine - manual' } }
		});

		await expect(result).resolves.toEqual({
			'aid-1': { aid: 'aid-1', name: 'Test Machine - manual' }
		});
	});

	it('resolves a reply that arrives before the publish is acknowledged', async () => {
		const result = runtime.get('jobs:aid-1');
		const requestId = lastRequestId();

		deliver('/rt/db/jobs:aid-1/result', { requestId, status: 'success', data: { j1: {} } });
		client.acks.at(-1)?.();

		await expect(result).resolves.toEqual({ j1: {} });
	});

	it('reports a failed publish', async () => {
		const result = runtime.get('jobs:aid-1');
		client.acks.at(-1)?.(new Error('broker down'));

		await expect(result).resolves.toEqual({
			error: 'Failed to publish operation: broker down'
		});
	});
});
