type AppLogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatTs(date = new Date()): string {
	return date.toISOString();
}

function log(
	level: AppLogLevel,
	namespace: string,
	event: string,
	data: Record<string, unknown> = {}
): void {
	const line = `[${namespace}] ${JSON.stringify({ ts: formatTs(), event, ...data })}`;

	switch (level) {
		case 'debug':
			console.debug(line);
			break;
		case 'info':
			console.info(line);
			break;
		case 'warn':
			console.warn(line);
			break;
		case 'error':
			console.error(line);
			break;
	}
}

export interface AppLogger {
	debug: (event: string, data?: Record<string, unknown>) => void;
	info: (event: string, data?: Record<string, unknown>) => void;
	warn: (event: string, data?: Record<string, unknown>) => void;
	error: (event: string, data?: Record<string, unknown>) => void;
}

export function createAppLogger(namespace: string): AppLogger {
	return {
		debug: (event, data) => log('debug', namespace, event, data ?? {}),
		info: (event, data) => log('info', namespace, event, data ?? {}),
		warn: (event, data) => log('warn', namespace, event, data ?? {}),
		error: (event, data) => log('error', namespace, event, data ?? {})
	};
}
