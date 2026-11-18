function normalizeEndpoint(endpoint?: string) {
	if (!endpoint) {
		return '/api/v1/';
	}

	if (endpoint.endsWith('/')) {
		return endpoint;
	}

	return `${endpoint}/`;
}

function resolveEndpoint() {
	const configuredEndpoint = normalizeEndpoint(import.meta.env.VITE_ENDPOINT);

	if (typeof window !== 'undefined') {
		try {
			const configuredUrl = new URL(configuredEndpoint, window.location.origin);
			const configuredHost = configuredUrl.hostname;
			const isConfiguredLocalhost =
				configuredHost === 'localhost' ||
				configuredHost === '127.0.0.1' ||
				configuredHost === '0.0.0.0';
			const isRuntimeLocalhost =
				window.location.hostname === 'localhost' ||
				window.location.hostname === '127.0.0.1' ||
				window.location.hostname === '0.0.0.0';

			if (isConfiguredLocalhost && !isRuntimeLocalhost) {
				return '/api/v1/';
			}
		} catch (error) {
			console.warn('Failed to parse configured endpoint, falling back to same-origin API.', error);
			return '/api/v1/';
		}
	}

	return configuredEndpoint;
}

export const END_POINT = resolveEndpoint();
export const AUTH_END_POINT = END_POINT.replace('/v1/', '/auth/');
export const DATAHUB_ENDPOINT = '/api/v2/datahub/';
export const FILES_ENDPOINT = '/api/v2/files/';

export function v1Url(path: string): string {
	return `${END_POINT}${path.replace(/^\//, '')}`;
}

export function datahubUrl(path: string): string {
	return `${DATAHUB_ENDPOINT}${path.replace(/^\//, '')}`;
}

export function filesUrl(path: string): string {
	return `${FILES_ENDPOINT}${path.replace(/^\//, '')}`;
}
