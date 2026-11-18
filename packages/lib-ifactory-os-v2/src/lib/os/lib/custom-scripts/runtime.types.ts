import type { IClientPublishOptions } from 'mqtt';

export type DbOperation = 'get' | 'add' | 'update' | 'delete';

export type RuntimeDbResult<T = unknown> = T | { error: string };

export interface DbQueryPayload {
	requestId: string;
	operation: DbOperation;
	data: Record<string, unknown>;
	timestamp: number;
}

export interface DbResponsePayload {
	requestId: string;
	error?: string;
	data?: unknown;
}

export interface PublishQueueItem {
	topic: string;
	message: unknown;
	options: IClientPublishOptions;
	callback?: (err?: Error) => void;
}

export interface PendingDbOperation {
	resolve: (value: RuntimeDbResult) => void;
	reject: (reason?: unknown) => void;
	timeout: ReturnType<typeof setTimeout>;
}

export interface RuntimeEvents {
	event: (topic: string, data: unknown) => void;
}
