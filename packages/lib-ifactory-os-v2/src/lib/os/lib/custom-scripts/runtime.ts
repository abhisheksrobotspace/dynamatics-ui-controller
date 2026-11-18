import { EventEmitter } from 'eventemitter3';
import mqtt, { type MqttClient } from 'mqtt';
import { getUUID } from '../utils/getUUID.js';
import type {
	DbOperation,
	DbQueryPayload,
	DbResponsePayload,
	PendingDbOperation,
	PublishQueueItem,
	RuntimeDbResult,
	RuntimeEvents
} from './runtime.types.js';

const DEFAULT_BROKER_URL = 'ws://localhost:9001';
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DB_OPERATION_TIMEOUT_MS = 30000;

export class Runtime extends EventEmitter<RuntimeEvents> {
	readonly appId: string;
	readonly brokerUrl: string;
	readonly maxReconnectAttempts: number;

	client: MqttClient | null = null;
	isConnected = false;
	reconnectAttempts = 0;

	private readonly publishQueue: PublishQueueItem[] = [];
	private readonly pendingDbOperations = new Map<string, PendingDbOperation>();
	/** Topics to subscribe on connect. Always includes `/rt/db/#` for DB responses. */
	private readonly subscribedTopics = new Set<string>(['/rt/db/#']);

	constructor(appId: string) {
		super();
		this.appId = appId;
		this.brokerUrl = DEFAULT_BROKER_URL;
		this.maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS;
		this.connect();
	}

	private connect(): void {
		if (this.client) {
			this.client.end(true);
		}

		console.log('Connecting to Runtime over MQTT', {
			brokerUrl: this.brokerUrl
		});

		this.client = mqtt.connect(this.brokerUrl, {
			clientId: this.appId,
			clean: true,
			reconnectPeriod: 1000,
			connectTimeout: 30000,
			keepalive: 60
		});

		this.setupEventHandlers();
	}

	private setupEventHandlers(): void {
		if (!this.client) {
			return;
		}

		this.client.on('connect', () => {
			console.log('Connected to Runtime');
			this.isConnected = true;
			this.reconnectAttempts = 0;

			const topics = [...this.subscribedTopics];
			this.subscribeNow(topics);

			this.processPublishQueue();
		});

		this.client.on('error', (err) => {
			console.error('Runtime error', { error: err.message });
			this.isConnected = false;
		});

		this.client.on('close', () => {
			console.log('Runtime connection closed');
			this.isConnected = false;
		});

		this.client.on('reconnect', () => {
			this.reconnectAttempts += 1;
			console.log('Runtime reconnecting', {
				attempt: this.reconnectAttempts,
				maxAttempts: this.maxReconnectAttempts
			});
		});

		this.client.on('offline', () => {
			console.warn('Runtime client offline');
			this.isConnected = false;
		});

		this.client.on('disconnect', () => {
			console.log('Runtime client disconnected');
			this.isConnected = false;
		});

		this.client.on('message', (topic, payload) => {
			this.handleMessage(topic, payload);
		});
	}

	private processPublishQueue(): void {
		while (this.publishQueue.length > 0) {
			const item = this.publishQueue.shift();
			if (item) {
				this.publishNow(item.topic, item.message, item.options, item.callback);
			}
		}
	}

	private publishNow(
		topic: string,
		message: unknown,
		options: PublishQueueItem['options'] = {},
		callback?: (err?: Error) => void
	): boolean {
		if (!this.client) {
			return false;
		}

		try {
			const jsonMessage = typeof message === 'string' ? message : JSON.stringify(message);

			this.client.publish(topic, jsonMessage, { qos: 1, ...options }, (err) => {
				if (err) {
					console.error('Publish error', { error: err.message, topic });
				}
				callback?.(err ?? undefined);
			});
			return true;
		} catch (error) {
			const messageText = error instanceof Error ? error.message : String(error);
			console.error('Publish failed', { error: messageText, topic });
			callback?.(error instanceof Error ? error : new Error(messageText));
			return false;
		}
	}

	private handleMessage(topic: string, payload: Buffer): void {
		let data: unknown;

		try {
			data = JSON.parse(payload.toString());
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(
				'Failed to parse message as JSON',
				JSON.stringify({
					topic,
					payload: payload.toString(),
					error: message
				})
			);
			return;
		}

		if (topic.startsWith('/rt/db/')) {
			// Only `/rt/db/<key>/result` answers a request. We subscribe to `/rt/db/#`, so our own
			// `/rt/db/<key>/<operation>` publish comes back too, with the same requestId and the
			// request's `data` (`{}` for a get); it must not resolve the request.
			if (topic.endsWith('/result')) {
				this.handleDbOperation(topic, data as DbResponsePayload);
			}
			return;
		}

		this.emit('event', topic, data);
	}

	private handleDbOperation(topic: string, data: DbResponsePayload): void {
		const pendingOperation = this.pendingDbOperations.get(data.requestId);

		if (!pendingOperation) {
			return;
		}

		const { resolve, timeout } = pendingOperation;

		if (typeof data.requestId !== 'string') {
			console.error('Invalid response: missing or invalid id field', {
				topic,
				data
			});
			clearTimeout(timeout);
			this.pendingDbOperations.delete(data.requestId);
			resolve({ error: 'Invalid response: missing or invalid id field' });
			return;
		}

		clearTimeout(timeout);
		this.pendingDbOperations.delete(data.requestId);

		if (data.error) {
			resolve({ error: data.error });
		} else if (data.data !== undefined) {
			resolve(data.data);
		} else {
			resolve({ error: 'Invalid response format for DB operation' });
		}
	}

	getConnectionStatus(): boolean {
		return this.isConnected && this.client !== null && this.client.connected;
	}

	/**
	 * Resolve when the broker is up, or `false` after `timeoutMs`.
	 * Boot paths use this before `get('machineSettings')` so we do not hang on a dead link.
	 */
	waitUntilConnected(timeoutMs = 10_000): Promise<boolean> {
		if (this.getConnectionStatus()) return Promise.resolve(true);

		return new Promise((resolve) => {
			const started = Date.now();
			const tick = setInterval(() => {
				if (this.getConnectionStatus()) {
					clearInterval(tick);
					resolve(true);
					return;
				}
				if (Date.now() - started >= timeoutMs) {
					clearInterval(tick);
					resolve(false);
				}
			}, 100);
		});
	}

	/**
	 * Register MQTT topics to receive. Adds to the subscribed set and, if
	 * already connected, subscribes only the newly added topics (qos 1).
	 * On (re)connect, the full set is subscribed.
	 */
	subscribeTopics(topics: string[]): void {
		const newTopics: string[] = [];
		for (const topic of topics) {
			if (!this.subscribedTopics.has(topic)) {
				this.subscribedTopics.add(topic);
				newTopics.push(topic);
			}
		}

		if (newTopics.length === 0) {
			return;
		}

		if (!this.getConnectionStatus()) {
			console.log('MQTT topics registered; will subscribe on connect', {
				topics: newTopics,
				total: this.subscribedTopics.size
			});
			return;
		}

		this.subscribeNow(newTopics);
	}

	private subscribeNow(topics: string[]): void {
		if (!this.client || topics.length === 0) {
			return;
		}

		this.client.subscribe(topics, { qos: 1 }, (err) => {
			if (err) {
				console.error('Failed to subscribe to MQTT topics', {
					error: err.message,
					topics
				});
			} else {
				console.log('Subscribed to MQTT topics', { topics });
			}
		});
	}

	reconnect(): void {
		console.log('Manual reconnection requested');
		this.reconnectAttempts = 0;
		this.connect();
	}

	publish(
		topic: string,
		message: unknown,
		options: PublishQueueItem['options'] = {},
		callback?: (err?: Error) => void
	): boolean {
		if (!this.getConnectionStatus()) {
			console.log('Queueing publish operation - not connected', { topic });
			this.publishQueue.push({ topic, message, options, callback });
			return true;
		}

		return this.publishNow(topic, message, options, callback);
	}

	disconnect(): void {
		if (this.client) {
			console.log('Disconnecting Runtime client');
			this.client.end(true);
			this.isConnected = false;
		}
	}

	async get<T = unknown>(key: string): Promise<RuntimeDbResult<T>> {
		return this.performDbOperation<T>('get', key);
	}

	async add<T = unknown>(
		key: string,
		data: Record<string, unknown> = {}
	): Promise<RuntimeDbResult<T>> {
		return this.performDbOperation<T>('add', key, data);
	}

	async update<T = unknown>(
		key: string,
		data: Record<string, unknown> = {}
	): Promise<RuntimeDbResult<T>> {
		return this.performDbOperation<T>('update', key, data);
	}

	async delete<T = unknown>(
		key: string,
		data: Record<string, unknown> = {}
	): Promise<RuntimeDbResult<T>> {
		return this.performDbOperation<T>('delete', key, data);
	}

	private performDbOperation<T>(
		operation: DbOperation,
		key: string,
		data: Record<string, unknown> = {}
	): Promise<RuntimeDbResult<T>> {
		return new Promise((resolve) => {
			const operationTopic = `/rt/db/${key}/${operation}`;
			const requestId = getUUID();

			const queryObj: DbQueryPayload = {
				requestId,
				operation,
				data,
				timestamp: Date.now()
			};

			const timeout = setTimeout(() => {
				this.pendingDbOperations.delete(requestId);
				resolve({ error: `Operation timeout: ${operation} on key ${key}` });
			}, DB_OPERATION_TIMEOUT_MS);

			// Registered before publishing: the reply can arrive before the publish callback runs.
			this.pendingDbOperations.set(requestId, {
				resolve: resolve as PendingDbOperation['resolve'],
				reject: () => {},
				timeout
			});

			this.publishNow(operationTopic, queryObj, {}, (err) => {
				if (err) {
					clearTimeout(timeout);
					this.pendingDbOperations.delete(requestId);
					resolve({ error: `Failed to publish operation: ${err.message}` });
				}
			});
		});
	}
}

export type { RuntimeDbResult } from './runtime.types.js';
